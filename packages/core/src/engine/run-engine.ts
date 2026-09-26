import { AgentReportSchema } from "@zeko/contracts";
import type {
  AgentAdapter, AgentCapabilities, AgentExecution, AgentId, AgentNode, Attempt, ClockPort,
  FlowFile, LaunchSpec, NodeRun, NormalizedEvent, PersistedEvent, Platform,
  ProcessOutcome, ProjectConfig, ReportCandidate, Run, RunStorePort, SlotLeasePort,
  WorkspacePort,
} from "@zeko/contracts";
import { calculateCostTotals } from "../policy/cost-totals.js";
import { deriveCapabilityPolicy, deriveConfinement } from "../policy/confinement.js";
import { decideRetry } from "../policy/retry.js";
import { buildPredecessorResults } from "../prompt/predecessor-results.js";
import { createApprovalRequest } from "./approvals.js";
import { renderTaskAssignment } from "../prompt/render-task-assignment.js";
import { resolveNodeResult } from "../result/resolve-node-result.js";
import { nextActions } from "../scheduler/next-actions.js";
import { SlotCoordinator } from "../scheduler/slots.js";
import { UsageGate } from "../scheduler/usage-gate.js";
import { resolveNodeModel } from "../validation/model.js";

export interface RunEngineOptions {
  flow: FlowFile;
  projectConfig: ProjectConfig;
  adapters: Partial<Record<AgentId, AgentAdapter>>;
  workspace: WorkspacePort;
  store: RunStorePort;
  slots: SlotLeasePort;
  clock: ClockPort;
  projectRoot: string;
  flowFile: string;
  flowHash: string;
  baseCommit: string;
  platform: Platform;
  hostPid: number;
  hostStartedAt: string;
  origin?: "desktop" | "cli";
  maxRetries?: number;
  concurrencyLimit?: number;
  enforceTimeouts?: boolean;
  reportSchema?: Record<string, unknown>;
  createId?: () => string;
  inspectFiles?: (workspacePath: string) => Promise<Array<{ path: string; change: string; eolOnly: boolean }>>;
  markWorkspaceUntrusted?: (workspacePath: string) => Promise<void>;
  requestApproval?: (request: { nodeId: string; summary: import("@zeko/contracts").PredecessorResult[] }) => Promise<boolean>;
  waitForUsageUpdate?: () => Promise<void>;
  usageGate?: UsageGate;
}

export interface RunEngineResult { run: Run; nodeRuns: ReadonlyMap<string, NodeRun> }

/** Runs a validated flow using only contracts ports and registered adapters. */
export class RunEngine {
  #activeExecutions = new Map<string, AgentExecution>();
  #cancelledNodes = new Set<string>();
  #runCancelled = false;
  #runId: string | undefined;
  #nodeRuns: Map<string, NodeRun> | undefined;
  #approvalCancels = new Map<string, () => void>();
  constructor(readonly options: RunEngineOptions) {}

  async cancelRun(): Promise<void> {
    if (this.#runCancelled) return;
    this.#runCancelled = true;
    if (this.#runId) await this.#emit(this.#runId, "run.cancel_requested", { origin: this.options.origin ?? "cli" });
    for (const cancel of this.#approvalCancels.values()) cancel();
    await Promise.all([...this.#activeExecutions.values()].map((execution) => execution.cancel("user")));
  }

  async cancelNode(nodeId: string): Promise<void> {
    this.#cancelledNodes.add(nodeId);
    this.#approvalCancels.get(nodeId)?.();
    const execution = this.#activeExecutions.get(nodeId);
    if (execution) {
      const nodeRun = this.#nodeRuns?.get(nodeId);
      if (this.#runId && nodeRun) await this.#emit(this.#runId, "node.cancel_requested", { origin: this.options.origin ?? "cli", phase: "tree_kill" }, nodeRun.id);
      await execution.cancel("user");
    }
  }

  async execute(): Promise<RunEngineResult> {
    const { options } = this;
    const now = options.clock.now();
    const runId = this.#id();
    const nodeRuns = new Map<string, NodeRun>();
    this.#runId = runId;
    this.#nodeRuns = nodeRuns;
    this.#lastNodeRuns = nodeRuns;
    const caps = new Map<string, AgentCapabilities>();
    for (const node of options.flow.nodes) {
      const adapter = node.type === "agent" ? options.adapters[node.agent] : undefined;
      const capabilities = adapter?.capabilities(options.platform);
      if (capabilities) caps.set(node.id, capabilities);
      const model = node.type === "agent" ? resolveNodeModel(node, options.projectConfig) : undefined;
      const policy = capabilities ? deriveCapabilityPolicy(capabilities, node.type === "agent" && node.terminal.enabled) : undefined;
      nodeRuns.set(node.id, {
        id: this.#id(), runId, nodeId: node.id, nodeType: node.type,
        ...(node.type === "agent" ? { agentId: node.agent } : {}),
        ...(model ? { model: { model: model.model, ...(model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}), source: model.source } } : {}),
        status: "pending", confinement: policy?.confinement ?? { level: "confined" },
        warnings: [...(policy?.warnings ?? []), ...(model?.warning ? [model.warning] : [])],
        attempts: [], reportState: node.type === "agent" ? "absent" : "not_applicable",
        denialCheck: capabilities?.reportsDenials ? "applied" : "not_available",
      });
    }
    const run: Run = {
      id: runId, projectRoot: options.projectRoot, flowId: options.flow.id, flowName: options.flow.name,
      flowFile: options.flowFile, flowSnapshot: structuredClone(options.flow), flowHash: options.flowHash,
      origin: options.origin ?? "cli", baseCommit: options.baseCommit, warnings: [], status: "running",
      startedAt: now, totals: calculateCostTotals([...nodeRuns.values()]), hostPid: options.hostPid,
      hostStartedAt: options.hostStartedAt, heartbeatAt: now,
    };
    await options.store.create(run);
    await this.#emit(runId, "run.started", { origin: run.origin, baseCommit: run.baseCommit, warnings: [], preflight: [] });

    const slots = new SlotCoordinator(options.slots, runId, options.concurrencyLimit ?? options.projectConfig.concurrencyLimit);
    const usageGate = options.usageGate ?? new UsageGate();
    const running = new Map<string, Promise<void>>();
    const nodeMap = new Map(options.flow.nodes.map((node) => [node.id, node]));
    let changed = true;
    while (changed || running.size > 0) {
      changed = false;
      for (const [nodeId, nodeRun] of nodeRuns) {
        if (nodeRun.status !== "pending" || (!this.#runCancelled && !this.#cancelledNodes.has(nodeId))) continue;
        nodeRun.status = "skipped";
        nodeRun.reason = { code: "RUN_CANCELLED", params: { sourceNodeId: nodeId } };
        changed = true;
        await this.#state(runId, nodeRun, "skipped", nodeRun.reason, "pending");
      }
      const actions = nextActions(options.flow, { statuses: Object.fromEntries([...nodeRuns].map(([id, n]) => [id, n.status])) });
      let heldForUsage = false;
      for (const action of actions) {
        const nodeRun = nodeRuns.get(action.nodeId);
        const node = nodeMap.get(action.nodeId);
        if (!nodeRun || !node) continue;
        if (this.#runCancelled || this.#cancelledNodes.has(action.nodeId)) {
          if (nodeRun.status === "pending") {
            nodeRun.status = "skipped";
            nodeRun.reason = { code: "RUN_CANCELLED", params: { sourceNodeId: action.nodeId } };
            changed = true;
            await this.#state(runId, nodeRun, "skipped", nodeRun.reason, "pending");
          }
          continue;
        }
        if (action.type === "complete_input") {
          nodeRun.status = "completed";
          changed = true;
          await this.#state(runId, nodeRun, "completed", undefined, "pending");
        } else if (action.type === "skip") {
          nodeRun.status = "skipped";
          nodeRun.reason = { code: "UPSTREAM_NOT_SUCCEEDED", params: { sourceNodeId: action.sourceNodeId } };
          changed = true;
          await this.#state(runId, nodeRun, "skipped", nodeRun.reason, "pending");
        } else if (action.type === "request_approval") {
          nodeRun.status = "waiting_approval";
          changed = true;
          await this.#state(runId, nodeRun, "waiting_approval", undefined, "pending");
          if (options.requestApproval) {
            const request = createApprovalRequest(options.flow, node.id, nodeRuns);
            const summary = request.summary;
            await this.#emit(runId, "approval.requested", { summary }, nodeRun.id);
            let cancelApproval!: () => void;
            const cancelled = new Promise<{ cancelled: true }>((resolve) => { cancelApproval = () => resolve({ cancelled: true }); });
            this.#approvalCancels.set(node.id, cancelApproval);
            const approvalKey = `approval:${node.id}`;
            const approval = (async (): Promise<void> => {
              const decision = await Promise.race([
                options.requestApproval?.(request).then((approved) => ({ cancelled: false as const, approved })) ?? Promise.resolve({ cancelled: false as const, approved: false }),
                cancelled,
              ]);
              this.#approvalCancels.delete(node.id);
              if (decision.cancelled) {
                nodeRun.status = "cancelled";
                nodeRun.reason = { code: "CANCELLED_BY_USER", params: {} };
              } else {
                nodeRun.status = decision.approved ? "approved" : "rejected";
                if (!decision.approved) nodeRun.reason = { code: "REJECTED_BY_USER", params: {} };
                await this.#emit(runId, "approval.decided", { decision: decision.approved ? "approved" : "rejected", origin: options.origin ?? "cli" }, nodeRun.id);
              }
              await this.#state(runId, nodeRun, nodeRun.status, nodeRun.reason, "waiting_approval");
            })().finally(() => { running.delete(approvalKey); });
            running.set(approvalKey, approval);
          }
        } else if (action.type === "run_agent" && node.type === "agent" && !running.has(node.id)) {
          if (slots.activeCount >= (options.concurrencyLimit ?? options.projectConfig.concurrencyLimit)) continue;
          if (!await slots.acquire(nodeRun.id)) continue;
          const reading = await options.adapters[node.agent]?.readUsage();
          const gate = usageGate.check(node.agent, reading, options.projectConfig.usageNearLimitThreshold, options.clock.now());
          if (gate.held) {
            nodeRun.hold = "USAGE_NEAR_LIMIT";
            heldForUsage = true;
            await slots.release(nodeRun.id);
            continue;
          }
          delete nodeRun.hold;
          nodeRun.status = "running";
          changed = true;
          await this.#state(runId, nodeRun, "running", undefined, "pending");
          const promise = this.#runAgent(runId, node, nodeRun, nodeRuns, caps.get(node.id), slots).finally(() => { running.delete(node.id); });
          running.set(node.id, promise);
        }
      }
      if (running.size > 0) await Promise.race(running.values());
      else if (heldForUsage) {
        run.hold = "USAGE_NEAR_LIMIT";
        await this.#emit(runId, "run.held", { reason: "USAGE_NEAR_LIMIT" });
        if (options.waitForUsageUpdate) {
          await options.waitForUsageUpdate();
          delete run.hold;
          changed = true;
        } else break;
      }
    }

    const terminal = [...nodeRuns.values()].every((n) => ["approved", "rejected", "completed", "blocked", "failed", "cancelled", "skipped", "interrupted"].includes(n.status));
    if (terminal) {
      run.status = this.#runCancelled ? "cancelled" : "finished";
      if (!this.#runCancelled) {
        run.outcome = [...nodeRuns.values()].every((n) => n.status === "approved" || n.status === "completed") ? "all_succeeded" : "some_not_succeeded";
      }
      run.endedAt = options.clock.now();
      run.durationMs = Date.parse(run.endedAt) - Date.parse(run.startedAt);
    }
    run.heartbeatAt = options.clock.now();
    run.totals = calculateCostTotals([...nodeRuns.values()]);
    if (terminal) await this.#emit(runId, "run.finished", { status: run.status, ...(run.outcome ? { outcome: run.outcome } : {}), totals: run.totals });
    return { run, nodeRuns };
  }

  async #runAgent(runId: string, node: AgentNode, nodeRun: NodeRun, allNodeRuns: Map<string, NodeRun>, capabilities: AgentCapabilities | undefined, slots: SlotCoordinator): Promise<void> {
    const adapter = this.options.adapters[node.agent];
    if (!adapter || !capabilities) {
      nodeRun.status = "failed";
      nodeRun.reason = { code: "AGENT_UNAVAILABLE", params: { agentId: node.agent } };
      await this.#state(runId, nodeRun, "failed", nodeRun.reason);
      await slots.release(nodeRun.id);
      return;
    }
    const resolved = resolveNodeModel(node, this.options.projectConfig);
    const inputNode = this.options.flow.nodes.find((candidate) => candidate.type === "input");
    const prompt = renderTaskAssignment({ assignment: {
      objective: inputNode?.type === "input" ? inputNode.objective : this.options.flow.name,
      instructions: node.instructions, acceptanceCriteria: node.acceptanceCriteria,
      predecessorResults: buildPredecessorResults(this.options.flow, node.id, allNodeRuns),
    } });
    const baseSpec: Omit<LaunchSpec, "attemptId" | "workspacePath"> = {
      agentId: node.agent, runId, nodeRunId: nodeRun.id,
      model: { model: resolved.model, ...(resolved.reasoningEffort ? { reasoningEffort: resolved.reasoningEffort } : {}) },
      prompt, reportSchema: this.options.reportSchema ?? AgentReportSchema.toJSONSchema() as Record<string, unknown>,
      writeScope: node.writeScope,
      terminal: { enabled: deriveConfinement(capabilities, node.terminal.enabled).effectiveTerminal, allowedCommands: node.terminal.allowedCommands },
      ...(capabilities.supportsTurnLimit ? { maxTurns: node.limits.maxTurns } : {}), platform: this.options.platform,
    };
    let agentRetries = 0;
    let infraRetries = 0;
    let attemptNo = 0;
    let outcome: ProcessOutcome = { kind: "crashed", durationMs: 0 };
    let candidate: ReportCandidate = { state: "absent" };
    let denials: Array<{ tool: string; reason: string; input?: unknown }> | undefined;
    const inferred: NonNullable<NodeRun["inferredDenials"]> = [];
    let observed: Array<{ path: string; change: string; eolOnly: boolean }> = [];
    let activeWorkspace: string | undefined;
    try {
      for (;;) {
        if (this.#runCancelled || this.#cancelledNodes.has(node.id)) {
          outcome = { kind: "killed", by: "user", phase: "tree_kill", durationMs: 0 };
          break;
        }
        attemptNo += 1;
        const attemptId = this.#id();
        const workspace = await this.options.workspace.create({ runId, nodeId: `${node.id}-attempt-${attemptNo}`, baseCommit: this.options.baseCommit });
        activeWorkspace = workspace.path;
        const attempt: Attempt = { id: attemptId, n: attemptNo, kind: attemptNo > 1 && nodeRun.attempts.at(-1)?.processOutcome?.kind === "infra_failure" ? "infra_retry" : "agent", workspacePath: workspace.path, startedAt: this.options.clock.now() };
        nodeRun.attempts.push(attempt);
        const launch: LaunchSpec = { ...baseSpec, attemptId, workspacePath: workspace.path };
        await this.#emit(runId, "node.attempt_started", { attemptId, n: attempt.n, kind: attempt.kind, workspace, confinement: nodeRun.confinement }, nodeRun.id, attemptId);
        const execution = adapter.launch(launch);
        this.#activeExecutions.set(node.id, execution);
        const collected = this.options.enforceTimeouts === false
          ? await this.#collect(execution, runId, nodeRun.id, attemptId)
          : await this.#collectWithTimeout(execution, runId, nodeRun.id, attemptId, node.limits.timeoutMinutes * 60_000);
        this.#activeExecutions.delete(node.id);
        outcome = collected.outcome;
        candidate = collected.report;
        denials = collected.denials;
        inferred.push(...collected.inferredDenials);
        const retry = decideRetry(outcome, this.options.maxRetries ?? node.limits.maxRetries, agentRetries, infraRetries);
        if (retry.retry) {
          if (retry.kind === "infra_retry") infraRetries += 1; else agentRetries += 1;
          attempt.processOutcome = outcome;
          attempt.endedAt = this.options.clock.now();
          await this.#emit(runId, "node.attempt_finished", { processOutcome: outcome }, nodeRun.id, attemptId);
          await this.options.workspace.remove(workspace.path);
          await this.options.clock.sleep(retry.delayMs ?? 0);
          continue;
        }
        observed = await this.options.inspectFiles?.(workspace.path) ?? [];
        if ((candidate.state === "absent" || candidate.state === "invalid") && !["infra_failure", "agent_error", "crashed", "spawn_failed", "killed"].includes(outcome.kind)) {
          await this.#emit(runId, "node.report_requested", { why: candidate.state, ...(candidate.state === "invalid" ? { zodErrors: candidate.zodErrors } : {}) }, nodeRun.id, attemptId);
          const reportExecution = adapter.requestReport(execution, launch);
          const reportCollection = await this.#collect(reportExecution, runId, nodeRun.id, attemptId);
          candidate = reportCollection.report;
          denials = reportCollection.denials ?? denials;
          inferred.push(...reportCollection.inferredDenials);
          await this.#emit(runId, "node.report_received", { reportState: candidate.state }, nodeRun.id, attemptId);
        }
        attempt.processOutcome = outcome;
        attempt.endedAt = this.options.clock.now();
        await this.#emit(runId, "node.attempt_finished", { processOutcome: outcome }, nodeRun.id, attemptId);
        break;
      }
    } catch (error) {
      outcome = { kind: "spawn_failed", cause: "other", detail: error instanceof Error ? error.message : "Agent launch failed", durationMs: 0 };
    } finally {
      await slots.release(nodeRun.id);
    }
    if ((this.#runCancelled || this.#cancelledNodes.has(node.id)) && activeWorkspace) await this.options.markWorkspaceUntrusted?.(activeWorkspace);
    const report = candidate.state === "valid" ? candidate.report : undefined;
    nodeRun.reportState = candidate.state;
    if (report) nodeRun.report = report;
    if (denials !== undefined) nodeRun.denials = denials;
    if (inferred.length) nodeRun.inferredDenials = inferred;
    if (observed.length) nodeRun.observedFiles = observed;
    if (outcome.cost) nodeRun.cost = outcome.cost;
    if (outcome.consumption) nodeRun.consumption = outcome.consumption;
    const result = resolveNodeResult({
      cancelledByUser: this.#runCancelled || this.#cancelledNodes.has(node.id), outcome, reportState: candidate.state,
      ...(report ? { report } : {}), ...(denials === undefined ? {} : { denials }),
      capabilities: { reportsDenials: capabilities.reportsDenials, supportsTurnLimit: capabilities.supportsTurnLimit },
      observedFiles: observed, writeScope: node.writeScope,
    });
      nodeRun.status = result.status;
    nodeRun.denialCheck = result.denialCheck ?? nodeRun.denialCheck;
    if (result.reason) nodeRun.reason = result.reason; else delete nodeRun.reason;
    if (result.inconsistency) nodeRun.inconsistency = result.inconsistency; else delete nodeRun.inconsistency;
    await this.#state(runId, nodeRun, nodeRun.status, nodeRun.reason, "running");
  }

  async #collect(execution: AgentExecution, runId: string, nodeRunId: string, attemptId: string): Promise<{ outcome: ProcessOutcome; report: ReportCandidate; denials?: Array<{ tool: string; reason: string; input?: unknown }>; inferredDenials: NonNullable<NodeRun["inferredDenials"]> }> {
    const denials: Array<{ tool: string; reason: string; input?: unknown }> = [];
    const inferredDenials: NonNullable<NodeRun["inferredDenials"]> = [];
    for await (const event of execution.events) {
      if (event.type === "permission_denied") denials.push({ tool: event.tool, reason: event.reason, ...(event.input === undefined ? {} : { input: event.input }) });
      if (event.type === "inferred_denial") inferredDenials.push({ source: event.source, message: event.message, ...(event.target ? { target: event.target } : {}) });
      if (event.type === "model_mismatch") {
        const n = [...this.#lastNodeRuns.values()].find((item) => item.id === nodeRunId);
        if (n && !n.warnings.includes("MODEL_MISMATCH")) n.warnings.push("MODEL_MISMATCH");
        if (n?.model) n.model = { ...n.model, effective: event.effective };
      }
      if (event.type === "session_started") {
        const n = [...this.#lastNodeRuns.values()].find((item) => item.id === nodeRunId);
        if (n?.model && event.model && event.model !== n.model.model) {
          n.model = { ...n.model, effective: event.model };
          if (!n.warnings.includes("MODEL_MISMATCH")) n.warnings.push("MODEL_MISMATCH");
        }
      }
      await this.#persistAgentEvent(runId, nodeRunId, attemptId, event);
    }
    const result = await execution.completion;
    return { outcome: result.outcome, report: result.report, ...(denials.length ? { denials } : result.outcome.denials === undefined ? {} : { denials: result.outcome.denials }), inferredDenials };
  }

  async #collectWithTimeout(execution: AgentExecution, runId: string, nodeRunId: string, attemptId: string, timeoutMs: number): Promise<{ outcome: ProcessOutcome; report: ReportCandidate; denials?: Array<{ tool: string; reason: string; input?: unknown }>; inferredDenials: NonNullable<NodeRun["inferredDenials"]> }> {
    const controller = new AbortController();
    const collecting = this.#collect(execution, runId, nodeRunId, attemptId);
    const timer = this.options.clock.sleep(timeoutMs, controller.signal).then(() => ({ expired: true as const }), () => ({ expired: false as const }));
    try {
      const winner = await Promise.race([
        collecting.then((result) => ({ expired: false as const, result })),
        timer,
      ]);
      if (!winner.expired) {
        controller.abort();
        return "result" in winner ? winner.result : collecting;
      }
      await execution.cancel("timeout");
      const stopped = await collecting;
      return { ...stopped, outcome: { kind: "killed", by: "timeout", phase: "tree_kill", durationMs: timeoutMs } };
    } catch (error) {
      controller.abort();
      throw error;
    }
  }

  #lastNodeRuns = new Map<string, NodeRun>();

  async #persistAgentEvent(runId: string, nodeRunId: string, attemptId: string, event: NormalizedEvent): Promise<void> {
    const common = { runId, nodeRunId, attemptId, ts: event.ts };
    let persisted: PersistedEvent;
    switch (event.type) {
      case "session_started": persisted = { ...common, type: "agent.session_started", payload: { sessionId: event.sessionId, ...(event.model ? { model: event.model } : {}), ...(event.tools ? { tools: event.tools } : {}), ...(event.agentVersion ? { agentVersion: event.agentVersion } : {}) } }; break;
      case "assistant_text": persisted = { ...common, type: "agent.text", payload: { text: event.text, ...(event.subagent ? { subagent: event.subagent } : {}) } }; break;
      case "tool_call": persisted = { ...common, type: "agent.tool_call", payload: { ...(event.toolUseId ? { toolUseId: event.toolUseId } : {}), name: event.name, input: event.input } }; break;
      case "tool_result": persisted = { ...common, type: "agent.tool_result", payload: { ...(event.toolUseId ? { toolUseId: event.toolUseId } : {}), ok: event.ok, content: event.content } }; break;
      case "permission_denied": persisted = { ...common, type: "agent.permission_denied", payload: { tool: event.tool, reason: event.reason, ...(event.input === undefined ? {} : { input: event.input }) } }; break;
      case "inferred_denial": persisted = { ...common, type: "agent.inferred_denial", payload: { source: event.source, message: event.message, ...(event.target ? { target: event.target } : {}) } }; break;
      case "usage": persisted = { ...common, type: "agent.usage", payload: { consumption: event.consumption ?? {}, ...(event.cost ? { cost: event.cost } : {}) } }; break;
      case "subscription_usage": persisted = { ...common, type: "agent.subscription_usage", payload: { agentId: event.agentId, authMode: event.authMode, windows: event.windows, readAt: event.readAt, live: event.live, source: event.source } }; break;
      case "stderr": persisted = { ...common, type: "agent.stderr", payload: { line: event.line } }; break;
      case "model_mismatch": persisted = { ...common, type: "error", payload: { code: "MODEL_MISMATCH", context: { requested: event.requested, effective: event.effective } } }; break;
      case "raw": persisted = { ...common, type: "error", payload: { code: "AGENT_RAW_EVENT", context: { data: event.data } } }; break;
    }
    await this.options.store.append(persisted);
  }

  async #state(runId: string, nodeRun: NodeRun, to: NodeRun["status"], reason?: NodeRun["reason"], from: NodeRun["status"] = nodeRun.status): Promise<void> {
    await this.#emit(runId, "node.state_changed", { from, to, ...(reason ? { reason } : {}) }, nodeRun.id);
  }

  async #emit(runId: string, type: PersistedEvent["type"], payload: Record<string, unknown>, nodeRunId?: string, attemptId?: string): Promise<void> {
    await this.options.store.append({ runId, ...(nodeRunId ? { nodeRunId } : {}), ...(attemptId ? { attemptId } : {}), ts: this.options.clock.now(), type, payload } as unknown as PersistedEvent);
  }

  #id(): string { return this.options.createId?.() ?? uuidV7(this.options.clock.now()); }
}

function uuidV7(now: string): string {
  const time = Math.max(0, Date.parse(now)).toString(16).padStart(12, "0").slice(-12);
  const random = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const variant = ((parseInt(random[4] ?? "8", 16) & 3) | 8).toString(16);
  return `${time.slice(0, 8)}-${time.slice(8)}-7${random.slice(0, 3)}-${variant}${random.slice(5, 8)}-${random.slice(8, 20)}`;
}
