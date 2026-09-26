import type {
  AgentAdapter, AgentAvailability, AgentCapabilities, AgentExecution, AgentId,
  AgentUsageReading, LaunchSpec, NormalizedEvent, Platform, ProcessOutcome,
  ReportCandidate,
} from "@zeko/contracts";

export interface ScriptedExecution {
  events?: readonly NormalizedEvent[];
  outcome?: ProcessOutcome;
  report?: ReportCandidate;
  sensitiveValues?: readonly string[];
  rootPid?: { pid: number; creationTime: number };
  deferCompletion?: boolean;
}

export interface ScriptedAdapterOptions {
  id?: AgentId;
  capabilities: AgentCapabilities | Partial<Record<Platform, AgentCapabilities>>;
  executions?: readonly ScriptedExecution[];
  availability?: AgentAvailability;
  usage?: AgentUsageReading;
}

const DEFAULT_OUTCOME: ProcessOutcome = { kind: "exited", exitCode: 0, durationMs: 0 };
const DEFAULT_REPORT: ReportCandidate = { state: "absent" };

/** Deterministic, process-free AgentAdapter for core/runtime tests. */
export class ScriptedAdapter implements AgentAdapter {
  readonly id: AgentId;
  readonly launches: Array<{ kind: "launch" | "requestReport"; spec: LaunchSpec }> = [];
  readonly cancellations: Array<{ execution: AgentExecution; reason: "user" | "timeout" | "shutdown" }> = [];
  readonly #capabilities: ScriptedAdapterOptions["capabilities"];
  readonly #executions: ScriptedExecution[];
  readonly #availability: AgentAvailability;
  readonly #usage: AgentUsageReading | undefined;

  constructor(options: ScriptedAdapterOptions) {
    this.id = options.id ?? "fake";
    this.#capabilities = options.capabilities;
    this.#executions = [...(options.executions ?? [])];
    this.#availability = options.availability ?? {
      agentId: this.id, installed: true,
      auth: { state: "authenticated", mode: "detect", verified: true }, problems: [],
    };
    this.#usage = options.usage;
  }

  capabilities(platform: Platform): AgentCapabilities {
    const configured = "terminal" in this.#capabilities
      ? this.#capabilities as AgentCapabilities
      : (this.#capabilities as Partial<Record<Platform, AgentCapabilities>>)[platform];
    if (!configured) throw new Error(`No scripted capabilities configured for ${platform}`);
    return structuredClone(configured);
  }

  async detect(): Promise<AgentAvailability> { return structuredClone(this.#availability); }
  async readUsage(): Promise<AgentUsageReading | undefined> { return this.#usage && structuredClone(this.#usage); }

  launch(spec: LaunchSpec): AgentExecution { return this.#nextExecution("launch", spec); }
  requestReport(_previous: AgentExecution, spec: LaunchSpec): AgentExecution {
    return this.#nextExecution("requestReport", spec);
  }

  #nextExecution(kind: "launch" | "requestReport", spec: LaunchSpec): AgentExecution {
    this.launches.push({ kind, spec: structuredClone(spec) });
    const script = this.#executions.shift() ?? {};
    let resolveCompletion!: (value: { outcome: ProcessOutcome; report: ReportCandidate }) => void;
    let completed = false;
    const completion = new Promise<{ outcome: ProcessOutcome; report: ReportCandidate }>((resolve) => { resolveCompletion = resolve; });
    const settle = (outcome: ProcessOutcome, report: ReportCandidate): void => {
      if (completed) return;
      completed = true;
      resolveCompletion({ outcome: structuredClone(outcome), report: structuredClone(report) });
    };
    if (!script.deferCompletion) settle(script.outcome ?? DEFAULT_OUTCOME, script.report ?? DEFAULT_REPORT);
    const execution: AgentExecution = {
      events: (async function* () { for (const event of script.events ?? []) yield structuredClone(event); })(),
      completion,
      cancel: async (reason) => {
        this.cancellations.push({ execution, reason });
        settle({ kind: "killed", by: reason, phase: "tree_kill", durationMs: 0 }, { state: "absent" });
      },
      rootPid: script.rootPid ?? { pid: 1, creationTime: 0 },
      sensitiveValues: [...(script.sensitiveValues ?? [])],
    };
    return execution;
  }
}
