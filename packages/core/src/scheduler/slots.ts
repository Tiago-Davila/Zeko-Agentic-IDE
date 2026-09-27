import type { SlotLeasePort } from "@zeko/contracts";

/** Project wide slot accounting. The lease port remains the source of truth. */
export class SlotCoordinator {
  readonly #port: SlotLeasePort;
  readonly #projectId: string;
  readonly #limit: number;
  readonly #owned = new Set<string>();

  constructor(port: SlotLeasePort, projectId: string, limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Slot limit must be a positive integer");
    this.#port = port;
    this.#projectId = projectId;
    this.#limit = limit;
  }
  async acquire(nodeRunId: string): Promise<boolean> {
    if (this.#owned.has(nodeRunId)) return true;
    const acquired = await this.#port.acquire(this.#projectId, nodeRunId, this.#limit);
    if (acquired) this.#owned.add(nodeRunId);
    return acquired;
  }
  async heartbeat(nodeRunId: string): Promise<void> {
    if (!this.#owned.has(nodeRunId)) throw new Error(`Slot is not owned: ${nodeRunId}`);
    await this.#port.heartbeat(nodeRunId);
  }
  async release(nodeRunId: string): Promise<void> {
    if (!this.#owned.delete(nodeRunId)) return;
    await this.#port.release(nodeRunId);
  }
  get activeCount(): number { return this.#owned.size; }
}
