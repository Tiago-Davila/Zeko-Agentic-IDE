import { AgentCapabilitiesSchema, ProcessOutcomeSchema, type AgentAdapter, type AgentAvailability, type AgentExecution, type AgentUsageReading, type LaunchSpec, type NormalizedEvent, type Platform, type ProcessOutcome, type ReportCandidate } from "@zeko/contracts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ProcessSupervisor, type SupervisedProcess } from "../process/supervisor.ts";
import { buildClaudeArgs } from "./args.ts";
import { claudeCodeCapabilities } from "../capabilities/claude-code.ts";
import { ClaudeStreamParser } from "./parser.ts";
import { resolveClaudeOutcome } from "./outcome.ts";

export interface ClaudeCodeAdapterOptions {
  /** Full path to Claude Code. Omit only for normal PATH resolution. */
  readonly binaryPath?: string;
  /** Prefix arguments used by supervised replay executables in tests. */
  readonly prefixArgs?: readonly string[];
  readonly versionArgs?: readonly string[];
  readonly authArgs?: readonly string[];
  readonly supervisor?: ProcessSupervisor;
  readonly interruptGraceMs?: number;
  readonly platform?: NodeJS.Platform;
}

const execFileAsync = promisify(execFile);

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = "claude-code" as const;
  readonly #binaryPath: string | undefined;
  readonly #prefixArgs: readonly string[];
  readonly #versionArgs: readonly string[];
  readonly #authArgs: readonly string[];
  readonly #supervisor: ProcessSupervisor;
  readonly #interruptGraceMs: number;
  readonly #platform: NodeJS.Platform;
  readonly #ownsSupervisor: boolean;

  constructor(options: ClaudeCodeAdapterOptions = {}) {
    this.#binaryPath = options.binaryPath;
    this.#prefixArgs = options.prefixArgs ?? [];
    this.#versionArgs = options.versionArgs ?? [];
    this.#authArgs = options.authArgs ?? ["auth", "status"];
    this.#supervisor = options.supervisor ?? new ProcessSupervisor();
    this.#interruptGraceMs = options.interruptGraceMs ?? 5_000;
    this.#platform = options.platform ?? process.platform;
    this.#ownsSupervisor = options.supervisor === undefined;
  }

  capabilities(platform: Platform) {
    return AgentCapabilitiesSchema.parse(claudeCodeCapabilities[platform]);
  }

  async detect(): Promise<AgentAvailability> {
    if (!this.#binaryPath && process.env["ZEKO_TEST"] === "1") {
      throw new Error("CLAUDE_BINARY_NOT_INJECTED: set binaryPath when ZEKO_TEST=1");
    }
    const command = this.#binaryPath ?? (this.#platform === "win32" ? "claude.exe" : "claude");
    let result: { code: number | null; stdout: string };
    try {
      result = await runVersion(command, this.#versionArgs.length > 0 ? this.#versionArgs : ["--version"]);
    } catch {
      result = { code: null, stdout: "" };
    }
    const version = result.code === 0 ? parseClaudeVersion(result.stdout) : undefined;
    const installed = result.code === 0 && version !== undefined;
    const authResult = installed ? await runVersion(command, this.#authArgs) : { code: null, stdout: "" };
    const auth = parseClaudeAuth(authResult.stdout);
    return {
      agentId: this.id,
      installed,
      ...(version ? { version } : {}),
      auth,
      problems: installed ? [] : ["Claude Code installation could not be verified"],
    };
  }

  async readUsage(): Promise<AgentUsageReading | undefined> {
    return undefined;
  }

  launch(spec: LaunchSpec): AgentExecution {
    return this.#createExecution(spec);
  }

  requestReport(previous: AgentExecution, spec: LaunchSpec): AgentExecution {
    return this.#createExecution(spec, previous.completion.then(({ outcome }) => outcome.sessionId));
  }

  async dispose(): Promise<void> {
    if (this.#ownsSupervisor) await this.#supervisor.dispose();
  }

  #createExecution(spec: LaunchSpec, resumeSession?: Promise<string | undefined>): AgentExecution {
    if (spec.agentId !== this.id) throw new Error("ClaudeCodeAdapter can only launch claude-code specs");
    if (!this.#binaryPath && process.env["ZEKO_TEST"] === "1") {
      throw new Error("CLAUDE_BINARY_NOT_INJECTED: set binaryPath when ZEKO_TEST=1");
    }

    const events = new EventQueue<NormalizedEvent>();
    const rootPid = { pid: 0, creationTime: 0 };
    const stderrLines: string[] = [];
    let supervised: SupervisedProcess | undefined;
    let parser: ClaudeStreamParser | undefined;
    let cancellation: { by: "user" | "timeout" | "shutdown"; phase: "interrupt" | "tree_kill" } | undefined;
    let stdinEnded = false;
    const startedAt = Date.now();
    const started = (async () => {
      const resumeSessionId = resumeSession ? await resumeSession : undefined;
      if (resumeSession && !resumeSessionId) throw new Error("Claude session is unavailable; cannot request a forked report");
      const command = this.#binaryPath ?? (this.#platform === "win32" ? "claude.exe" : "claude");
      const args = buildClaudeArgs(spec, {
        schemaPath: JSON.stringify(spec.reportSchema),
        ...(resumeSessionId ? { resumeSessionId } : {}),
      });
      const processHandle = await this.#supervisor.launch(command, [...this.#prefixArgs, ...args], { cwd: spec.workspacePath });
      supervised = processHandle;
      parser = new ClaudeStreamParser({ attemptId: spec.attemptId, requestedModel: spec.model.model });
      rootPid.pid = processHandle.rootPid.pid;
      rootPid.creationTime = processHandle.rootPid.creationTime;
      await processHandle.writeStdin(`${JSON.stringify({ type: "user", message: { role: "user", content: spec.prompt } })}\n`);
      return processHandle;
    })();

    const completion: Promise<{ outcome: ProcessOutcome; report: ReportCandidate }> = started.then(async (processHandle) => {
      const eventParser = parser!;
      const consumeStdout = async (): Promise<void> => {
        for await (const line of processHandle.stdout) {
          for (const event of eventParser.parse(line)) await events.push(event);
          if (eventParser.result && !stdinEnded) {
            stdinEnded = true;
            processHandle.endStdin();
          }
        }
      };
      const consumeStderr = async (): Promise<void> => {
        for await (const line of processHandle.stderr) {
          stderrLines.push(line);
          await events.push({ type: "stderr", ts: new Date().toISOString(), attemptId: spec.attemptId, line });
        }
      };
      const streams = Promise.all([consumeStdout(), consumeStderr()]);
      const close = await processHandle.completion;
      await streams;
      events.close();
      const resolution = resolveClaudeOutcome({
        ...(eventParser.result ? { result: eventParser.result } : {}),
        close: { exitCode: close.code, signal: close.signal },
        durationMs: Date.now() - startedAt,
        ...(typeof eventParser.result?.["session_id"] === "string" ? { sessionId: eventParser.result["session_id"] } : {}),
        ...(cancellation ? { cancellation } : {}),
        stderrLines,
      });
      return resolution;
    }).catch((error: unknown) => {
      events.close();
      const processHandle = supervised;
      if (processHandle) void this.#supervisor.terminate(processHandle.rootPid).catch(() => undefined);
      return {
        outcome: ProcessOutcomeSchema.parse({ kind: "spawn_failed", cause: "other", detail: errorMessage(error), durationMs: Date.now() - startedAt }),
        report: { state: "absent" },
      };
    });

    return {
      events,
      completion,
      rootPid,
      sensitiveValues: [],
      forceTerminate: async () => {
        const processHandle = supervised ?? await started.catch(() => undefined);
        if (!processHandle) return;
        cancellation = { by: "user", phase: "tree_kill" };
        await this.#supervisor.terminate(processHandle.rootPid);
      },
      cancel: async (reason) => {
        const processHandle = supervised ?? await started.catch(() => undefined);
        if (!processHandle || cancellation) return;
        cancellation = { by: reason, phase: "interrupt" };
        try {
          await processHandle.writeStdin(`${JSON.stringify({ type: "control_request", request_id: spec.attemptId, request: { subtype: "interrupt" } })}\n`);
          const closed = await raceTimeout(processHandle.completion, this.#interruptGraceMs);
          if (closed) {
            if (await this.#supervisor.hasLiveDescendants(processHandle.rootPid)) {
              cancellation.phase = "tree_kill";
              await this.#supervisor.terminate(processHandle.rootPid);
            }
            return;
          }
        } catch {
          // A closed stdin or unresponsive CLI proceeds to tree termination.
        }
        cancellation.phase = "tree_kill";
        await this.#supervisor.terminate(processHandle.rootPid);
      },
    };
  }
}

class EventQueue<T> implements AsyncIterable<T> {
  readonly #values: T[] = [];
  readonly #waiters: Array<(result: IteratorResult<T>) => void> = [];
  #ended = false;

  async push(value: T): Promise<void> {
    if (this.#ended) return;
    const waiter = this.#waiters.shift();
    if (waiter) waiter({ done: false, value });
    else this.#values.push(value);
  }

  close(): void {
    this.#ended = true;
    for (const waiter of this.#waiters.splice(0)) waiter({ done: true, value: undefined });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.#values.shift();
        if (value !== undefined) return Promise.resolve({ done: false, value });
        if (this.#ended) return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolve) => this.#waiters.push(resolve));
      },
    };
  }
}

async function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([promise, new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Claude Code launch failed";
}

async function runVersion(command: string, args: readonly string[]): Promise<{ code: number | null; stdout: string }> {
  try {
    const result = await execFileAsync(command, [...args], {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 2_048,
      encoding: "utf8",
    });
    return { code: 0, stdout: result.stdout.slice(0, 2_048) };
  } catch {
    return { code: null, stdout: "" };
  }
}

function parseClaudeVersion(output: string): string | undefined {
  return /(?:Claude Code\s+)?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)/iu.exec(output)?.[1];
}

function parseClaudeAuth(output: string): AgentAvailability["auth"] {
  try {
    const value: unknown = JSON.parse(output);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { state: "unknown", mode: "detect", verified: false };
    const record = value as Record<string, unknown>;
    if (record["loggedIn"] === false) return { state: "not_authenticated", mode: "detect", verified: true };
    if (record["loggedIn"] !== true) return { state: "unknown", mode: "detect", verified: false };
    const authMethod = typeof record["authMethod"] === "string" ? record["authMethod"].toLowerCase().replaceAll(/[^a-z]/gu, "") : "";
    const mode = authMethod === "claudeai" ? "subscription" : authMethod === "apikey" ? "api_key" : "detect";
    return { state: "authenticated", mode, verified: true };
  } catch {
    return { state: "unknown", mode: "detect", verified: false };
  }
}
