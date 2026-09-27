import type { NormalizedEvent } from "@zeko/contracts";

export class RingBuffer<T> {
  readonly #values: Array<T | undefined>;
  #start = 0;
  #length = 0;
  #snapshot: readonly T[] | undefined = Object.freeze([]);

  constructor(readonly capacity = 5_000) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("Ring buffer capacity must be a positive integer");
    this.#values = new Array<T | undefined>(capacity);
  }

  get length(): number { return this.#length; }
  snapshot(): readonly T[] {
    if (!this.#snapshot) this.#snapshot = Object.freeze(Array.from({ length: this.#length }, (_, index) => this.#values[(this.#start + index) % this.capacity]).filter((item): item is T => item !== undefined));
    return this.#snapshot;
  }

  push(value: T): T | undefined {
    let evicted: T | undefined;
    if (this.#length === this.capacity) {
      evicted = this.#values[this.#start];
      this.#values[this.#start] = value;
      this.#start = (this.#start + 1) % this.capacity;
    } else {
      this.#values[(this.#start + this.#length) % this.capacity] = value;
      this.#length += 1;
    }
    this.#snapshot = undefined;
    return evicted;
  }
}

const EMPTY: readonly NormalizedEvent[] = Object.freeze([]);

interface NodeBuffer {
  events: RingBuffer<NormalizedEvent>;
  fingerprints: Set<string>;
  cursor: number;
}

export class OutputStore {
  readonly #buffers = new Map<string, NodeBuffer>();
  readonly #listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getEvents = (runId: string, nodeId: string): readonly NormalizedEvent[] => this.#buffers.get(key(runId, nodeId))?.events.snapshot() ?? EMPTY;
  getCursor(runId: string, nodeId: string): number { return this.#buffers.get(key(runId, nodeId))?.cursor ?? 0; }

  setCursor(runId: string, nodeId: string, cursor: number): void {
    const buffer = this.#buffer(runId, nodeId);
    if (cursor > buffer.cursor) buffer.cursor = cursor;
  }

  append(runId: string, nodeId: string, event: NormalizedEvent): void {
    this.appendMany(runId, nodeId, [event]);
  }

  appendMany(runId: string, nodeId: string, events: readonly NormalizedEvent[]): void {
    const buffer = this.#buffer(runId, nodeId);
    let changed = false;
    for (const event of events) {
      const fingerprint = eventFingerprint(event);
      if (buffer.fingerprints.has(fingerprint)) continue;
      const evicted = buffer.events.push(event);
      if (evicted) buffer.fingerprints.delete(eventFingerprint(evicted));
      buffer.fingerprints.add(fingerprint);
      changed = true;
    }
    if (!changed) return;
    for (const listener of this.#listeners) listener();
  }

  #buffer(runId: string, nodeId: string): NodeBuffer {
    const id = key(runId, nodeId);
    let buffer = this.#buffers.get(id);
    if (!buffer) { buffer = { events: new RingBuffer<NormalizedEvent>(5_000), fingerprints: new Set(), cursor: 0 }; this.#buffers.set(id, buffer); }
    return buffer;
  }
}

function key(runId: string, nodeId: string): string { return `${runId}\0${nodeId}`; }
function eventFingerprint(event: NormalizedEvent): string { return `${event.attemptId}\0${event.type}\0${event.ts}`; }

export const outputStore = new OutputStore();
