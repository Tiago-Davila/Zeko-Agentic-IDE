import type { IpcEventSchema } from "@zeko/contracts";

export type EngineEvent = typeof IpcEventSchema._output;
type OutputEvent = { kind: "event"; type: "node.output"; runId?: string | undefined; payload: unknown; seq?: number | undefined };

/** Coalesces output per run/node without delaying state or other event types. */
export class OutputBatcher {
  readonly #pending = new Map<string, OutputEvent>();
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly emit: (event: EngineEvent) => void, private readonly intervalMs = 50) {}

  push(event: EngineEvent): void {
    if (event.type !== "node.output") {
      this.flush();
      this.emit(event);
      return;
    }
    const payload = event.payload as { nodeId?: unknown; events?: unknown };
    if (typeof payload.nodeId !== "string" || !Array.isArray(payload.events)) return;
    const safeEvents = payload.events.filter((item) => typeof item === "object" && item !== null && (item as Record<string, unknown>)["type"] !== "raw");
    if (safeEvents.length === 0) return;
    const key = `${event.runId ?? ""}\0${payload.nodeId}`;
    const previous = this.#pending.get(key);
    const combined = previous ? [...(previous.payload as { events: unknown[] }).events, ...safeEvents] : safeEvents;
    this.#pending.set(key, { ...event, type: "node.output", payload: { ...payload, events: combined } });
    if (!this.#timer) this.#timer = setTimeout(() => this.flush(), this.intervalMs);
  }

  flush(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const event of pending) this.emit(event);
  }

  close(): void { this.flush(); }
}
