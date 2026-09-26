import type {
  ClockPort, FlowFile, PersistedEvent, Run, RunStorePort, SlotLeasePort,
  UsageStorePort, WorkspacePort,
} from "@zeko/contracts";

interface ClockWaiter {
  deadline: number;
  resolve: () => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
}

export class InMemoryWorkspacePort implements WorkspacePort {
  readonly workspaces = new Map<string, { runId: string; nodeId: string; baseCommit: string; branch: string }>();
  #created = 0;
  async create(input: { runId: string; nodeId: string; baseCommit: string }): Promise<{ path: string; branch: string }> {
    this.#created += 1;
    const path = `/memory/${input.runId}/${input.nodeId}/${this.#created}`;
    const branch = `zeko/${input.runId}/${input.nodeId}/${this.#created}`;
    this.workspaces.set(path, { ...input, branch });
    return { path, branch };
  }
  async remove(path: string): Promise<void> { this.workspaces.delete(path); }
}

export class InMemoryRunStore implements RunStorePort {
  readonly runs = new Map<string, Run>();
  readonly events: PersistedEvent[] = [];
  readonly flowSnapshots = new Map<string, FlowFile>();
  async create(run: Run): Promise<void> { this.runs.set(run.id, structuredClone(run)); }
  async get(runId: string): Promise<Run | undefined> {
    const run = this.runs.get(runId);
    return run && structuredClone(run);
  }
  async append(event: PersistedEvent): Promise<void> { this.events.push(structuredClone(event)); }
  async saveFlowSnapshot(runId: string, flow: FlowFile): Promise<void> { this.flowSnapshots.set(runId, structuredClone(flow)); }
}

export class InMemorySlotLeasePort implements SlotLeasePort {
  readonly leases = new Map<string, { projectId: string; nodeRunId: string; heartbeatCount: number }>();
  async acquire(projectId: string, nodeRunId: string, limit: number): Promise<boolean> {
    if (this.leases.has(nodeRunId)) return true;
    const projectCount = [...this.leases.values()].filter((lease) => lease.projectId === projectId).length;
    if (projectCount >= limit) return false;
    this.leases.set(nodeRunId, { projectId, nodeRunId, heartbeatCount: 0 });
    return true;
  }
  async heartbeat(nodeRunId: string): Promise<void> {
    const lease = this.leases.get(nodeRunId);
    if (!lease) throw new Error(`No slot lease for ${nodeRunId}`);
    lease.heartbeatCount += 1;
  }
  async release(nodeRunId: string): Promise<void> { this.leases.delete(nodeRunId); }
}

export class InMemoryUsageStore implements UsageStorePort {
  readonly readings = new Map<string, Awaited<ReturnType<UsageStorePort["readLatest"]>>>();
  async readLatest(agentId: string, authMode: string) {
    const reading = this.readings.get(`${agentId}:${authMode}`);
    return reading && structuredClone(reading);
  }
  async write(reading: Parameters<UsageStorePort["write"]>[0]): Promise<void> {
    this.readings.set(`${reading.agentId}:${reading.authMode}`, structuredClone(reading));
  }
}

export class ControllableClock implements ClockPort {
  #milliseconds: number;
  readonly sleeps: number[] = [];
  readonly #autoAdvance: boolean;
  readonly #waiters: ClockWaiter[] = [];
  constructor(initial: string | number = "2026-01-01T00:00:00.000Z", options: { autoAdvance?: boolean } = {}) {
    this.#milliseconds = typeof initial === "number" ? initial : Date.parse(initial);
    if (!Number.isFinite(this.#milliseconds)) throw new Error("Invalid initial clock time");
    this.#autoAdvance = options.autoAdvance ?? true;
  }
  now(): string { return new Date(this.#milliseconds).toISOString(); }
  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds)) throw new Error("Clock advance must be finite");
    this.#milliseconds += milliseconds;
    for (const waiter of [...this.#waiters]) if (waiter.deadline <= this.#milliseconds) this.#resolveWaiter(waiter);
  }
  async sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    this.sleeps.push(milliseconds);
    if (this.#autoAdvance) { this.advance(milliseconds); return; }
    return new Promise<void>((resolve, reject) => {
      const waiter = { deadline: this.#milliseconds + milliseconds, resolve, reject, ...(signal ? { signal } : {}) };
      this.#waiters.push(waiter);
      signal?.addEventListener("abort", () => {
        const index = this.#waiters.indexOf(waiter);
        if (index >= 0) this.#waiters.splice(index, 1);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
  }

  #resolveWaiter(waiter: ClockWaiter): void {
    const index = this.#waiters.indexOf(waiter);
    if (index >= 0) this.#waiters.splice(index, 1);
    waiter.resolve();
  }
}
