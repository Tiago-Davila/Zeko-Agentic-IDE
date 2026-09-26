import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AgentIdSchema, type AgentAdapter, type AgentId, type FlowFile, type ProjectConfig, type PersistedEvent } from "@zeko/contracts";
import { validateEdge, validateFlow as validateGraphFlow, RunEngine } from "@zeko/core";
import { cleanupRunWorktrees, getFileDiff, getObservedFiles, getRepositoryInfo, GitWorkspacePort } from "@zeko/git";
import { createRedactor, migrate, NodeSqliteDriver, RunsRepository, SqliteSlotLeases, type SqlDriver } from "@zeko/storage";
import { createAdapterRegistry, IPC_EVENT_TYPES, IPC_METHODS } from "./adapter-registry.js";
import { FlowFiles, FlowFileError } from "./flow-files.js";
import { getRuntimePaths } from "./paths.js";
import { preflight as checkPreflight } from "./preflight.js";
import { ProjectConfigFile } from "./project-config-file.js";
import { recoverInterruptedRuns } from "./recovery.js";

export interface CreateZekoRuntimeOptions {
  readonly dbPath?: string;
  readonly worktreeRoot?: string;
  readonly adapters?: Partial<Record<AgentId, AgentAdapter>>;
  readonly platform?: NodeJS.Platform;
  readonly approval?: (input: { runId: string; nodeId: string; summary: unknown[] }) => Promise<boolean>;
  readonly driver?: SqlDriver;
}

export type RuntimeEvent = { kind: "event"; type: (typeof import("./adapter-registry.js").IPC_EVENT_TYPES)[number]; runId?: string; payload: unknown; seq?: number };
export type RuntimeListener = (event: RuntimeEvent) => void;

/** Shared composition root consumed directly by CLI and the Electron engine host. */
export async function createZekoRuntime(options: CreateZekoRuntimeOptions = {}) {
  const paths = getRuntimePaths({ ...(options.platform ? { platform: options.platform } : {}) });
  const dbPath = options.dbPath ?? paths.database;
  await mkdir(dirname(dbPath), { recursive: true });
  await mkdir(options.worktreeRoot ?? paths.worktrees, { recursive: true });
  const db = options.driver ?? new NodeSqliteDriver(dbPath);
  migrate(db);
  const redactor = createRedactor();
  const runs = new RunsRepository(db, redactor);
  const store = {
    create: runs.create.bind(runs), get: runs.get.bind(runs), saveFlowSnapshot: runs.saveFlowSnapshot.bind(runs),
    saveNodeRun: runs.saveNodeRun.bind(runs), updateRun: runs.updateRun.bind(runs),
    async append(event: PersistedEvent) {
      await runs.append(event);
      const payload = event.payload as Record<string, unknown>;
      if (event.type === "run.started") emit("run.started", payload, event.runId);
      else if (event.type === "run.held") emit("run.held", payload, event.runId);
      else if (event.type === "run.resumed") emit("run.resumed", payload, event.runId);
      else if (event.type === "run.finished") emit("run.finished", payload, event.runId);
      else if (event.type === "node.state_changed") {
        const node = event.nodeRunId ? db.prepare("SELECT node_id AS nodeId FROM node_runs WHERE id=?").get(event.nodeRunId) as { nodeId: string } | undefined : undefined;
        emit("node.state", { nodeId: node?.nodeId, status: payload["to"], reason: payload["reason"], hold: payload["hold"] }, event.runId);
      }
      else if (event.type === "node.result") emit("node.result", { nodeId: event.nodeRunId, result: payload }, event.runId);
      else if (event.type === "approval.requested") {
        const node = event.nodeRunId ? db.prepare("SELECT node_id AS nodeId FROM node_runs WHERE id=?").get(event.nodeRunId) as { nodeId: string } | undefined : undefined;
        emit("approval.requested", { nodeId: node?.nodeId, summary: payload["summary"] }, event.runId);
      }
      else if (event.type === "agent.subscription_usage") emit("agent.usage", payload, event.runId);
      else if (event.type === "error") emit("engine.error", payload, event.runId);
      else if (event.type === "agent.text" || event.type === "agent.tool_call" || event.type === "agent.tool_result" || event.type === "agent.permission_denied" || event.type === "agent.stderr") emit("node.output", { nodeId: event.nodeRunId, events: [{ type: event.type, ...payload }] }, event.runId);
    },
  };
  const slots = new SqliteSlotLeases(db);
  const adapters = createAdapterRegistry(options.adapters);
  const listeners = new Set<RuntimeListener>();
  const projects = new Map<string, string>();
  const engines = new Map<string, RunEngine>();
  const approvals = new Map<string, { promise: Promise<boolean>; resolve: (approved: boolean) => void }>();
  const running = new Map<string, Promise<unknown>>();
  const recovered = await recoverInterruptedRuns({ db, runs, redactor });

  const emit = (type: RuntimeEvent["type"], payload: unknown, runId?: string) => {
    const event: RuntimeEvent = { kind: "event", type, payload, ...(runId ? { runId } : {}) };
    for (const listener of listeners) listener(event);
  };
  const rootFor = (projectId: string) => projects.get(projectId) ?? resolve(projectId);
  const filesFor = (projectId: string) => new FlowFiles(rootFor(projectId));
  const configFor = (projectId: string) => new ProjectConfigFile(rootFor(projectId));

  async function openProject(path: string) {
    const info = await getRepositoryInfo(path);
    const projectId = info.root;
    projects.set(projectId, info.root);
    return { projectId, root: info.root, flows: await filesFor(projectId).listFlows() };
  }
  async function validate(flow: FlowFile, projectRoot: string) {
    const config = await new ProjectConfigFile(projectRoot).getSettings();
    return { diagnostics: validateGraphFlow(flow, config), nodeViews: flow.nodes.filter((node) => node.type === "agent").map((node) => ({
      nodeId: node.id, model: node.models?.[node.agent] ? { ...node.models[node.agent], source: "node" as const } : null,
      warnings: node.models?.[node.agent] ? [] : ["MODEL_DEFAULTED" as const], confinement: { level: "confined" as const }, notApplicable: [],
    })) };
  }
  async function startRun(projectId: string, flowId: string, fileHash: string, origin: "cli" | "desktop" = "desktop") {
    const root = rootFor(projectId);
    const loaded = await filesFor(projectId).loadFlow(flowId);
    if (loaded.fileHash !== fileHash) throw new FlowFileError("FILE_CHANGED_ON_DISK", "Flow changed on disk", loaded.fileHash);
    if (!loaded.flow || loaded.diagnostics.some((item) => item.severity === "error")) throw new RuntimeError("FLOW_INVALID", "Flow has validation errors");
    const diagnostics = await validate(loaded.flow, root);
    if (diagnostics.diagnostics.some((item) => item.severity === "error")) throw new RuntimeError("FLOW_INVALID", "Flow has validation errors");
    const checks = await checkPreflight(loaded.flow, adapters);
    emit("engine.error", { code: "preflight", ok: checks.ok, missing: checks.missing });
    if (!checks.ok) throw new RuntimeError("PREFLIGHT_FAILED", "One or more agents are unavailable or unauthenticated");
    const repository = await getRepositoryInfo(root);
    const config = await configFor(projectId).getSettings();
    const runId = cryptoId();
    const engine = new RunEngine({
      flow: loaded.flow, projectConfig: config, adapters, workspace: new GitWorkspacePort(root, options.worktreeRoot ?? paths.worktrees), store, slots,
      clock: { now: () => new Date().toISOString(), sleep: (milliseconds, signal) => new Promise<void>((resolveSleep, reject) => {
        const timer = setTimeout(resolveSleep, milliseconds); signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
      }) }, projectRoot: root, flowFile: join(root, ".zeko", "flows", `${flowId}.flow.yaml`), flowHash: fileHash,
      baseCommit: repository.head, platform: process.platform === "win32" ? "win32" : "linux", hostPid: process.pid,
      hostStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), origin, createId: (() => { let first = true; return () => { if (first) { first = false; return runId; } return cryptoId(); }; })(),
      concurrencyLimit: config.concurrencyLimit, inspectFiles: async () => [], markWorkspaceUntrusted: async () => undefined,
      requestApproval: (request) => {
        if (options.approval) return options.approval({ runId, nodeId: request.nodeId, summary: request.summary });
        const key = `${runId}:${request.nodeId}`;
        const existing = approvals.get(key);
        if (existing) return existing.promise;
        let resolveApproval!: (approved: boolean) => void;
        const promise = new Promise<boolean>((resolvePromise) => { resolveApproval = resolvePromise; });
        approvals.set(key, { promise, resolve: resolveApproval });
        return promise;
      },
    });
    engines.set(runId, engine);
    const execution = engine.execute().then((result) => {
      emit("run.finished", { runId, status: result.run.status, outcome: result.run.outcome, totals: result.run.totals }, runId);
      return result;
    }).catch((error: unknown) => { emit("engine.error", { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) }, runId); throw error; })
      .finally(() => { engines.delete(runId); running.delete(runId); });
    running.set(runId, execution);
    return { runId, wait: execution };
  }

  const api = {
    async openProject(path: string) { return openProject(path); },
    async listFlows(projectId: string) { return filesFor(projectId).listFlows(); },
    async loadFlow(projectId: string, flowId: string) { return filesFor(projectId).loadFlow(flowId); },
    async createFlow(projectId: string, name: string) { return filesFor(projectId).createFlow(name, name); },
    async saveFlow(projectId: string, flow: FlowFile, expectedHash: string) { return filesFor(projectId).saveFlow(flow, expectedHash); },
    async deleteFlow(projectId: string, flowId: string, confirmed: boolean) { return filesFor(projectId).deleteFlow(flowId, confirmed); },
    async validateFlow(projectId: string, flow: FlowFile) { return validate(flow, rootFor(projectId)); },
    validateEdge(_projectId: string, flow: FlowFile, edge: FlowFile["edges"][number]) { return validateEdge(flow, edge); },
    async agentsStatus(_projectId: string, agentIds?: AgentId[]) {
      const requested = agentIds ?? Object.keys(adapters).filter((id) => AgentIdSchema.safeParse(id).success) as AgentId[];
      const results = await Promise.all(requested.map(async (id) => adapters[id]?.detect()));
      return results.filter((item) => item !== undefined).map((item) => ({ availability: item, usage: undefined }));
    },
    async preflight(projectId: string, flowId: string) { const loaded = await filesFor(projectId).loadFlow(flowId); if (!loaded.flow) return { ok: false, diagnostics: loaded.diagnostics, agents: [], perNodeAuth: [], warnings: [] }; return { ...await checkPreflight(loaded.flow, adapters), diagnostics: loaded.diagnostics }; },
    async startRun(projectId: string, flowId: string, fileHash: string, origin?: "cli" | "desktop") { return startRun(projectId, flowId, fileHash, origin); },
    async cancelRun(runId: string) { await engines.get(runId)?.cancelRun(); },
    async forceCancelRun(runId: string) { await engines.get(runId)?.forceCancelRun(); },
    async cancelNode(runId: string, nodeId: string) { await engines.get(runId)?.cancelNode(nodeId); },
    async decideApproval(runId: string, nodeId: string, decision: "approved" | "rejected") {
      const pending = approvals.get(`${runId}:${nodeId}`);
      if (!pending) throw new RuntimeError("NOT_WAITING_APPROVAL", "Node is not waiting for approval");
      approvals.delete(`${runId}:${nodeId}`); pending.resolve(decision === "approved");
    },
    async listRuns(projectId: string, _flowId?: string, limit = 50) { return db.prepare("SELECT id,flow_id AS flowId,status,started_at AS startedAt,ended_at AS endedAt FROM runs WHERE project_id=(SELECT id FROM projects WHERE root_path=?) ORDER BY started_at DESC LIMIT ?").all(rootFor(projectId), limit); },
    async getRun(runId: string) { return runs.get(runId); },
    async nodeOutputPage(runId: string, nodeId: string, afterSeq = 0, limit = 500) { return runs.events.page(runId, nodeId, afterSeq, limit); },
    async nodeDiff(runId: string, nodeId: string, path?: string) {
      const run = await runs.get(runId); if (!run) throw new RuntimeError("RUN_NOT_FOUND", "Run was not found");
      const row = db.prepare("SELECT base_commit AS baseCommit,result_commit AS resultCommit FROM node_runs WHERE run_id=? AND node_id=?").get(runId, nodeId) as { baseCommit?: string; resultCommit?: string } | undefined;
      if (!row?.resultCommit) throw new RuntimeError("WORKSPACE_DELETED", "Node has no retained workspace changes");
      const files = await getObservedFiles({ cwd: run.projectRoot, baseCommit: row.baseCommit ?? run.baseCommit, resultCommit: row.resultCommit });
      const patch = path ? await getFileDiff({ cwd: run.projectRoot, baseCommit: row.baseCommit ?? run.baseCommit, resultCommit: row.resultCommit, path }) : undefined;
      return { files, ...(patch ? { patch: patch.patch } : {}) };
    },
    async deleteWorkspaces(runId: string, confirmed: boolean) {
      if (!confirmed) throw new RuntimeError("CONFIRMATION_REQUIRED", "Workspace deletion requires confirmation");
      if (running.has(runId)) throw new RuntimeError("RUN_ACTIVE", "Cannot delete workspaces for an active run");
      const run = await runs.get(runId); if (!run) throw new RuntimeError("RUN_NOT_FOUND", "Run was not found");
      const workspaces = db.prepare("SELECT w.path,w.branch FROM workspaces w JOIN node_runs n ON n.id=w.node_run_id WHERE n.run_id=? AND w.state!='deleted'").all(runId) as Array<{ path: string; branch: string }>;
      const cleanup = await cleanupRunWorktrees({ repoPath: run.projectRoot, worktreeRoot: options.worktreeRoot ?? paths.worktrees, runId, confirmed: true, workspaces });
      return { deleted: cleanup.removed.length };
    },
    async getSettings(projectId: string) { return configFor(projectId).getSettings(); },
    async setSettings(projectId: string, config: ProjectConfig) { return configFor(projectId).setSettings(config); },
    subscribe(listener: RuntimeListener) {
      listeners.add(listener);
      if (recovered.runIds.length) listener({ kind: "event", type: "runs.recovered", payload: { runIds: recovered.runIds } });
      return () => listeners.delete(listener);
    },
    recoveredRunIds: recovered.runIds,
    ipcHandlers: {} as Record<(typeof IPC_METHODS)[number], (...args: never[]) => unknown>,
    close() { slots.close(); if (!options.driver) db.close(); listeners.clear(); },
    database: db,
  };
  const ipcHandlers = {
    "project.open": api.openProject, "flow.list": api.listFlows, "flow.load": api.loadFlow, "flow.create": api.createFlow,
    "flow.save": api.saveFlow, "flow.delete": api.deleteFlow, "flow.validate": api.validateFlow, "flow.validateEdge": api.validateEdge,
    "agents.status": api.agentsStatus, "run.preflight": api.preflight, "run.start": api.startRun, "run.cancel": api.cancelRun,
    "node.cancel": api.cancelNode, "approval.decide": api.decideApproval, "run.list": api.listRuns, "run.get": api.getRun,
    "node.output.page": api.nodeOutputPage, "node.diff": api.nodeDiff, "workspaces.delete": api.deleteWorkspaces,
    "settings.get": api.getSettings, "settings.set": api.setSettings,
  };
  Object.assign(api.ipcHandlers, ipcHandlers);
  if (Object.keys(api.ipcHandlers).length !== IPC_METHODS.length || IPC_EVENT_TYPES.length !== 12) throw new Error("Runtime IPC handlers/events are incomplete");
  return api;
}

class RuntimeError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "RuntimeError"; }
}
function cryptoId(): string { return randomUUID().replace(/^[0-9a-f]{8}-[0-9a-f]{4}-4/, (prefix) => `${prefix.slice(0, -1)}7`); }
