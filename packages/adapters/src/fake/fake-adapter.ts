import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AgentCapabilitiesSchema, NormalizedEventSchema, ProcessOutcomeSchema, ReportCandidateSchema, type AgentAdapter, type AgentAvailability, type AgentCapabilities, type AgentExecution, type LaunchSpec, type NormalizedEvent, type Platform, type ProcessOutcome, type ReportCandidate } from "@zeko/contracts";
import { ProcessSupervisor, type SupervisedProcess } from "../process/supervisor.ts";

export interface FakeAdapterOptions {
  readonly scenarioPath?: string;
  readonly fakeAgentPath?: string;
  readonly capabilities?: Partial<Record<Platform, AgentCapabilities>>;
  readonly supervisor?: ProcessSupervisor;
  readonly interruptGraceMs?: number;
}

export class FakeAdapter implements AgentAdapter {
  readonly id = "fake" as const;
  readonly #scenarioPath: string;
  readonly #fakeAgentPath: string;
  readonly #capabilities: Record<Platform, AgentCapabilities>;
  readonly #supervisor: ProcessSupervisor;
  readonly #interruptGraceMs: number;
  readonly #ownsSupervisor: boolean;

  constructor(options: FakeAdapterOptions = {}) {
    this.#scenarioPath = options.scenarioPath ?? fileURLToPath(new URL("../../test/fake-agent/scenarios/done.json", import.meta.url));
    this.#fakeAgentPath = options.fakeAgentPath ?? resolveFakeAgentPath();
    this.#capabilities = {
      win32: AgentCapabilitiesSchema.parse(options.capabilities?.win32 ?? fakeCapabilities("win32")),
      linux: AgentCapabilitiesSchema.parse(options.capabilities?.linux ?? fakeCapabilities("linux")),
    };
    this.#supervisor = options.supervisor ?? new ProcessSupervisor();
    this.#ownsSupervisor = options.supervisor === undefined;
    this.#interruptGraceMs = options.interruptGraceMs ?? 5_000;
  }

  capabilities(platform: Platform): AgentCapabilities {
    return this.#capabilities[platform];
  }

  async detect(): Promise<AgentAvailability> {
    return {
      agentId: "fake",
      installed: true,
      version: "native-test-agent",
      auth: { state: "authenticated", mode: "detect", verified: true },
      problems: [],
    };
  }

  async readUsage(): Promise<undefined> {
    return undefined;
  }

  launch(spec: LaunchSpec): AgentExecution {
    if (spec.agentId !== "fake") throw new Error("FakeAdapter can only launch specs for agentId fake");
    return this.#createExecution(spec);
  }

  requestReport(_previous: AgentExecution, spec: LaunchSpec): AgentExecution {
    return this.launch(spec);
  }

  async dispose(): Promise<void> {
    if (this.#ownsSupervisor) await this.#supervisor.dispose();
  }

  #createExecution(spec: LaunchSpec): AgentExecution {
    const rootPid = { pid: 0, creationTime: 0 };
    const events = new EventQueue<NormalizedEvent>();
    let supervised: SupervisedProcess | undefined;
    let cancelled: { readonly reason: "user" | "timeout" | "shutdown"; phase: "interrupt" | "tree_kill" } | undefined;
    const startedAt = Date.now();
    const started = this.#supervisor.launch(process.execPath, ["--experimental-strip-types", this.#fakeAgentPath, this.#scenarioPath], {
      cwd: spec.workspacePath,
      env: { ...process.env, ZEKO_FAKE_AGENT_STARTUP_DELAY_MS: "2500" },
    }).then((processHandle) => {
      supervised = processHandle;
      rootPid.pid = processHandle.rootPid.pid;
      rootPid.creationTime = processHandle.rootPid.creationTime;
      return processHandle;
    });

    const completion: Promise<{ outcome: ProcessOutcome; report: ReportCandidate }> = started.then(async (processHandle) => {
      let candidateOutcome: ProcessOutcome | undefined;
      let candidateReport: ReportCandidate | undefined;
      const consumeStdout = async (): Promise<void> => {
        for await (const line of processHandle.stdout) {
          const parsed = parseEvent(line);
          if (!parsed) continue;
          if (parsed.type === "raw") {
            const fakeResult = record(parsed.data)?.["fakeAgentResult"];
            const rawOutcome = record(fakeResult)?.["outcome"];
            const rawReport = record(fakeResult)?.["reportCandidate"];
            if (rawOutcome !== undefined) candidateOutcome = ProcessOutcomeSchema.parse(rawOutcome);
            if (rawReport !== undefined) candidateReport = ReportCandidateSchema.parse(rawReport);
          }
          await events.push({ ...parsed, attemptId: spec.attemptId } as NormalizedEvent);
        }
      };
      const consumeStderr = async (): Promise<void> => {
        for await (const line of processHandle.stderr) {
          await events.push({ type: "stderr", ts: new Date().toISOString(), attemptId: spec.attemptId, line });
        }
      };
      const streams = Promise.all([consumeStdout(), consumeStderr()]);
      const closed = await processHandle.completion;
      await streams;
      events.close();
      if (cancelled) {
        return {
          outcome: ProcessOutcomeSchema.parse({ kind: "killed", by: cancelled.reason, phase: cancelled.phase, durationMs: Date.now() - startedAt }),
          report: candidateReport ?? { state: "absent" },
        };
      }
      const outcome = candidateOutcome ?? defaultOutcome(closed.code, closed.signal, Date.now() - startedAt);
      return { outcome, report: candidateReport ?? { state: "absent" } };
    }).catch((error: unknown) => {
      events.close();
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
      cancel: async (reason) => {
        const processHandle = supervised ?? await started.catch(() => undefined);
        if (!processHandle) return;
        if (cancelled) return;
        const capability = this.#capabilities[spec.platform];
        if (capability.orderlyInterrupt) {
          cancelled = { reason, phase: "interrupt" };
          try {
            await processHandle.writeStdin(`${JSON.stringify({ type: "control_request", subtype: "interrupt", requestId: spec.attemptId })}\n`);
            const closed = await raceTimeout(processHandle.completion, this.#interruptGraceMs);
            if (closed) {
              const registered = this.#supervisor.registeredProcesses(processHandle.rootPid);
              if (registered.length <= 1) return;
              cancelled.phase = "tree_kill";
              await this.#supervisor.terminate(processHandle.rootPid);
              return;
            }
          } catch {
            // A closed stdin or unresponsive agent proceeds to tree termination.
          }
        }
        cancelled = { reason, phase: "tree_kill" };
        await this.#supervisor.terminate(processHandle.rootPid);
      },
    };
  }
}

function resolveFakeAgentPath(): string {
  const candidates = [
    fileURLToPath(new URL("../../test/fake-agent/main.js", import.meta.url)),
    fileURLToPath(new URL("../../test/fake-agent/main.ts", import.meta.url)),
  ];
  const path = candidates.find(existsSync);
  if (!path) throw new Error("fake-agent native entry point was not found; set FakeAdapterOptions.fakeAgentPath");
  return path;
}

function parseEvent(line: string): NormalizedEvent | undefined {
  try {
    const parsed = NormalizedEventSchema.safeParse(JSON.parse(line) as unknown);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function defaultOutcome(code: number | null, signal: NodeJS.Signals | null, durationMs: number): ProcessOutcome {
  if (code === 0) return ProcessOutcomeSchema.parse({ kind: "exited", exitCode: 0, durationMs });
  if (signal) return ProcessOutcomeSchema.parse({ kind: "crashed", ...(code === null ? {} : { exitCode: code }), signal, durationMs });
  return ProcessOutcomeSchema.parse({ kind: "agent_error", exitCode: code ?? 1, durationMs });
}

function fakeCapabilities(platform: Platform): AgentCapabilities {
  return {
    terminal: { canDisable: true },
    confinement: { noTerminal: "full", withTerminal: "write_only" },
    writeScopeEnforcement: { unrestricted: "prevent", partial: "prevent" },
    commandAllowlist: { supported: true, shell: platform === "win32" ? "PowerShell" : "Bash", readonlyAutoApproved: false },
    reportsDenials: true,
    infersDenials: false,
    supportsTurnLimit: true,
    timeLimit: "engine",
    orderlyInterrupt: true,
    network: "none",
    structuredOutput: true,
    reportRequest: "exec_fork",
    explicitModel: true,
    reportsCost: true,
    reportsConsumption: true,
    subscriptionUsage: "live",
    authModes: [{ mode: "detect", verified: true }],
    infraFailureClasses: [],
    processTree: platform === "win32" ? "windows_process_tree" : "process_group",
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "fake-agent launch failed";
}

async function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([promise, new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
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
