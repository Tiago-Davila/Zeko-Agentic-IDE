import { afterEach, describe, expect, it, vi } from "vitest";
import { OutputBatcher, type EngineEvent } from "../../src/engine-host/output-batcher.js";

const output = (nodeId: string, content: string): EngineEvent => ({
  kind: "event", type: "node.output", runId: "018f0000-0000-7000-8000-000000000001",
  payload: { nodeId, events: [{ type: "assistant_text", text: content }] },
});

describe("engine-host output batching", () => {
  afterEach(() => vi.useRealTimers());

  it("groups output for each node within the 50 ms window", () => {
    vi.useFakeTimers();
    const emitted: EngineEvent[] = [];
    const batcher = new OutputBatcher((event) => emitted.push(event));
    batcher.push(output("a", "one"));
    batcher.push(output("b", "other node"));
    batcher.push(output("a", "two"));
    vi.advanceTimersByTime(49);
    expect(emitted).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(emitted).toHaveLength(2);
    expect((emitted[0]?.payload as { events: unknown[] }).events).toHaveLength(2);
  });

  it("never delays state events and strips raw events", () => {
    const emitted: EngineEvent[] = [];
    const batcher = new OutputBatcher((event) => emitted.push(event));
    batcher.push({ ...output("a", "visible"), payload: { nodeId: "a", events: [{ type: "raw", text: "private" }, { type: "assistant_text", text: "visible" }] } });
    batcher.push({ kind: "event", type: "node.state", runId: "018f0000-0000-7000-8000-000000000001", payload: { nodeId: "a", status: "running" } });
    expect(emitted.map((event) => event.type)).toEqual(["node.output", "node.state"]);
    expect((emitted[0]?.payload as { events: Array<{ type: string }> }).events.map((event) => event.type)).toEqual(["assistant_text"]);
    batcher.close();
  });
});
