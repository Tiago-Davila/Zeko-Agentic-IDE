import { AgentCapabilitiesSchema, ProcessOutcomeSchema, type AgentAdapter, type AgentAvailability, type AgentExecution, type AgentUsageReading, type LaunchSpec, type NormalizedEvent, type Platform, type ProcessOutcome, type ReportCandidate } from "@zeko/contracts";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ProcessSupervisor, type SupervisedProcess } from "../process/supervisor.ts";
import { codexCapabilities } from "../capabilities/codex.ts";
import { buildCodexEnvironment, codexSensitiveValues } from "./env.ts";
import { resolveCodexBinary } from "./binary.ts";
import { buildCodexArgs } from "./args.ts";
import { CodexExecParser } from "./parser.ts";
import { CodexRolloutReader } from "./rollout.ts";
import { classifyCodexSignatures } from "./signatures.ts";
import { resolveCodexOutcome } from "./outcome.ts";
import { createCodexSchemaFile } from "./schema-file.ts";

export interface CodexAdapterOptions {
  readonly binaryPath?: string;
  readonly prefixArgs?: readonly string[];
  readonly supervisor?: ProcessSupervisor;
  readonly platform?: NodeJS.Platform;
  readonly codexHome?: string;
  readonly apiKey?: string;
  readonly windowsSandbox?: "elevated" | "unelevated";
  readonly forkReport?: boolean;
  readonly versionArgs?: readonly string[];
  readonly authArgs?: readonly string[];
  readonly sandboxSetup?: () => Promise<boolean>;
}

export class CodexAdapter implements AgentAdapter {
  readonly id = "codex" as const;
  readonly #binaryPath: string | undefined;
  readonly #prefixArgs: readonly string[];
  readonly #supervisor: ProcessSupervisor;
  readonly #platform: NodeJS.Platform;
  #windowsSandbox: "elevated" | "unelevated";
  readonly #forkReport: boolean;
  readonly #apiKey: string | undefined;
  readonly #rollouts: CodexRolloutReader;
  readonly #ownsSupervisor: boolean;
  readonly #versionArgs: readonly string[];
  readonly #authArgs: readonly string[];
  readonly #sandboxSetup: () => Promise<boolean>;

  constructor(options: CodexAdapterOptions = {}) {
    this.#binaryPath = options.binaryPath;
    this.#prefixArgs = options.prefixArgs ?? [];
    this.#supervisor = options.supervisor ?? new ProcessSupervisor();
    this.#platform = options.platform ?? process.platform;
    this.#windowsSandbox = options.windowsSandbox ?? "unelevated";
    this.#forkReport = options.forkReport ?? false;
    this.#versionArgs = options.versionArgs ?? ["--version"];
    this.#authArgs = options.authArgs ?? ["login", "status"];
    this.#sandboxSetup = options.sandboxSetup ?? hasWindowsSandboxSetup;
    this.#apiKey = options.apiKey;
    this.#rollouts = new CodexRolloutReader({ codexHome: options.codexHome ?? process.env["CODEX_HOME"] ?? join(homedir(), ".codex") });
    this.#ownsSupervisor = options.supervisor === undefined;
  }

  capabilities(platform: Platform) { return AgentCapabilitiesSchema.parse(codexCapabilities[platform]); }
  async detect(): Promise<AgentAvailability> {
    let binary: string;
    try { binary = resolveCodexBinary({ ...(this.#binaryPath ? { binaryPath: this.#binaryPath } : {}), platform: this.#platform, env: process.env }); }
    catch { return { agentId: this.id, installed: false, auth: { state: "unknown", mode: this.#apiKey ? "api_key" : "detect", verified: false }, problems: ["Codex installation could not be verified"] }; }
    const env = buildCodexEnvironment(this.#apiKey);
    const versionResult = await runExit(binary, this.#versionArgs, env);
    const version = versionResult.code === 0 ? parseVersion(versionResult.stdout) : undefined;
    const installed = version !== undefined;
    let auth: AgentAvailability["auth"] = { state: "unknown", mode: this.#apiKey ? "api_key" : "detect", verified: false };
    if (installed && this.#apiKey) auth = { state: "authenticated", mode: "api_key", verified: false };
    else if (installed) {
      const status = await runExit(binary, this.#authArgs, env);
      auth = status.code === 0 ? { state: "authenticated", mode: "subscription", verified: true } : status.code === 1 ? { state: "not_authenticated", mode: "subscription", verified: true } : { state: "unknown", mode: "detect", verified: false };
    }
    if (installed && this.#platform === "win32" && await this.#sandboxSetup()) this.#windowsSandbox = "elevated";
    const problems = installed ? (this.#platform === "win32" ? [`Windows sandbox mode: ${this.#windowsSandbox}`] : []) : ["Codex installation could not be verified"];
    return { agentId: this.id, installed, ...(version ? { version } : {}), auth, problems };
  }
  async readUsage(): Promise<AgentUsageReading | undefined> { return (await this.#rollouts.read())?.usage; }
  launch(spec: LaunchSpec): AgentExecution { return this.#createExecution(spec); }
  requestReport(previous: AgentExecution, spec: LaunchSpec): AgentExecution {
    const threadId = this.#forkReport ? previous.completion.then(({ outcome }) => outcome.sessionId) : undefined;
    return this.#createExecution({ ...spec, prompt: `${spec.prompt}\n\nReturn only the required structured report. Do not perform any additional work.` }, threadId);
  }
  async dispose(): Promise<void> { if (this.#ownsSupervisor) await this.#supervisor.dispose(); }

  #createExecution(spec: LaunchSpec, forkThreadId?: Promise<string | undefined>): AgentExecution {
    if (spec.agentId !== this.id) throw new Error("CodexAdapter can only launch codex specs");
    const command = resolveCodexBinary({ ...(this.#binaryPath ? { binaryPath: this.#binaryPath } : {}), platform: this.#platform, env: process.env });
    const events = new EventQueue<NormalizedEvent>();
    const rootPid = { pid: 0, creationTime: 0 };
    const startedAt = Date.now();
    const stderrLines: string[] = [];
    let supervised: SupervisedProcess | undefined;
    let cancelled: { by: "user" | "timeout" | "shutdown"; phase: "tree_kill" } | undefined;
    let cancellationRequested: "user" | "timeout" | "shutdown" | undefined;
    const completion = (async (): Promise<{ outcome: ProcessOutcome; report: ReportCandidate }> => {
      let schemaFile: Awaited<ReturnType<typeof createCodexSchemaFile>> | undefined;
      try {
        const threadId = await forkThreadId;
        schemaFile = await createCodexSchemaFile(spec.reportSchema, spec.attemptId);
        const args = buildCodexArgs(spec, { outputSchemaPath: schemaFile.path, windowsSandbox: this.#windowsSandbox, ...(threadId ? { forkThreadId: threadId } : {}) });
        const child = await this.#supervisor.launch(command, [...this.#prefixArgs, ...args], { cwd: spec.workspacePath, env: buildCodexEnvironment(this.#apiKey) });
        supervised = child;
        rootPid.pid = child.rootPid.pid;
        rootPid.creationTime = child.rootPid.creationTime;
        if (cancellationRequested) { cancelled = { by: cancellationRequested, phase: "tree_kill" }; await this.#supervisor.terminate(child.rootPid); }
        const parser = new CodexExecParser({ attemptId: spec.attemptId });
        let sessionId: string | undefined;
        let finalMessage: string | undefined;
        let completed = false;
        let failed = false;
        let consumption: ProcessOutcome["consumption"];
        const consumeStdout = async (): Promise<void> => {
          for await (const line of child.stdout) {
            let raw: Record<string, unknown> | undefined;
            try { raw = asRecord(JSON.parse(line)); } catch { /* parser ignores malformed JSON */ }
            if (raw?.["type"] === "turn.completed") completed = true;
            if (raw?.["type"] === "turn.failed") failed = true;
            for (const event of parser.parse(line)) {
              if (event.type === "session_started") sessionId = event.sessionId;
              if (event.type === "assistant_text") finalMessage = event.text;
              if (event.type === "usage") consumption = event.consumption;
              await events.push(event);
            }
          }
        };
        const consumeStderr = async (): Promise<void> => {
          for await (const line of child.stderr) { stderrLines.push(line); await events.push({ type: "stderr", ts: new Date().toISOString(), attemptId: spec.attemptId, line }); }
        };
        await child.writeStdin(spec.prompt);
        child.endStdin();
        const streams = Promise.all([consumeStdout(), consumeStderr()]);
        const close = await child.completion;
        await streams;
        const rollout = await this.#rollouts.read(sessionId);
        const diagnostics = [...stderrLines, ...(rollout?.rejections.map((item) => JSON.stringify(item)) ?? [])];
        const signature = classifyCodexSignatures(diagnostics);
        if (rollout?.model && rollout.model !== spec.model.model) await events.push({ type: "model_mismatch", ts: new Date().toISOString(), attemptId: spec.attemptId, requested: spec.model.model, effective: rollout.model });
        if (rollout?.usage) await events.push({ type: "subscription_usage", ts: new Date().toISOString(), attemptId: spec.attemptId, ...rollout.usage });
        if (signature.kind === "inferred_denial") await events.push({ type: "inferred_denial", ts: new Date().toISOString(), attemptId: spec.attemptId, source: "agent_policy", message: "Codex reported a policy denial" });
        const result = resolveCodexOutcome({ exitCode: close.code, signal: close.signal, durationMs: rollout?.durationMs ?? Date.now() - startedAt, ...(sessionId ? { sessionId } : {}), completed, failed, ...(finalMessage ? { finalMessage } : {}), ...(consumption ? { usage: consumption } : {}), ...(signature.kind === "infra_failure" ? { infrastructureFailure: signature.cause } : {}), ...(cancelled ? { cancellation: cancelled } : {}) });
        return result;
      } catch (error) {
        if (supervised) void this.#supervisor.terminate(supervised.rootPid).catch(() => undefined);
        return { outcome: ProcessOutcomeSchema.parse({ kind: "spawn_failed", cause: "other", detail: safeError(error), durationMs: Date.now() - startedAt }), report: { state: "absent" } };
      } finally {
        await schemaFile?.cleanup().catch(() => undefined);
        events.close();
      }
    })();
    const terminate = async (reason: "user" | "timeout" | "shutdown"): Promise<void> => {
      if (cancelled) return;
      cancellationRequested = reason;
      if (!supervised) return;
      cancelled = { by: reason, phase: "tree_kill" };
      await this.#supervisor.terminate(supervised.rootPid);
    };
    return {
      events, completion, rootPid, sensitiveValues: codexSensitiveValues(this.#apiKey),
      forceTerminate: async () => terminate("user"),
      cancel: terminate,
    };
  }
}

class EventQueue<T> implements AsyncIterable<T> {
  readonly #values: T[] = [];
  readonly #waiters: Array<(result: IteratorResult<T>) => void> = [];
  #ended = false;
  async push(value: T): Promise<void> { if (this.#ended) return; const waiter = this.#waiters.shift(); if (waiter) waiter({ done: false, value }); else this.#values.push(value); }
  close(): void { this.#ended = true; for (const waiter of this.#waiters.splice(0)) waiter({ done: true, value: undefined }); }
  [Symbol.asyncIterator](): AsyncIterator<T> { return { next: () => { const value = this.#values.shift(); if (value !== undefined) return Promise.resolve({ done: false, value }); if (this.#ended) return Promise.resolve({ done: true, value: undefined }); return new Promise((resolve) => this.#waiters.push(resolve)); } }; }
}

function asRecord(value: unknown): Record<string, unknown> | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function safeError(error: unknown): string { return error instanceof Error ? error.message : "Codex launch failed"; }

const execFileAsync = promisify(execFile);
async function runExit(command: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string }> {
  try {
    const result = await execFileAsync(command, [...args], { cwd: process.cwd(), env, shell: false, windowsHide: true, timeout: 5_000, maxBuffer: 4_096, encoding: "utf8" });
    return { code: 0, stdout: result.stdout.slice(0, 4_096) };
  } catch (error) {
    const result = asRecord(error);
    const code = typeof result?.["code"] === "number" ? result["code"] : null;
    const stdout = typeof result?.["stdout"] === "string" ? result["stdout"].slice(0, 4_096) : "";
    return { code, stdout };
  }
}
function parseVersion(output: string): string | undefined { return /(?:Codex CLI\s+)?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)/iu.exec(output)?.[1]; }
async function hasWindowsSandboxSetup(): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const service = await runExit("sc.exe", ["query", "codex-windows-sandbox-service"], process.env);
  if (service.code !== 0) return false;
  const account = await runExit("net.exe", ["user", "CodexSandboxOffline"], process.env);
  return account.code === 0;
}
