import { describe, expect, it } from "vitest";
import { RunStateStore } from "../src/renderer/run/run-state-store.js";
import type { ZekoEvent } from "../src/renderer/ipc/client.js";

const event = (runId: string, payload: Record<string, unknown>): ZekoEvent => ({ kind: "event", type: "node.state", runId, payload });

describe("renderer run state store", () => {
  it("publishes node state synchronously for the matching run", () => {
    const store = new RunStateStore();
    let updates = 0;
    const unsubscribe = store.subscribe(() => { updates += 1; });
    store.accept(event("018f0000-0000-7000-8000-000000000001", {
      nodeId: "implement", status: "running", reason: { code: "AGENT_UNAVAILABLE", params: {} },
    }));
    expect(store.getSnapshot("018f0000-0000-7000-8000-000000000001")["implement"]).toMatchObject({ status: "running", reason: { code: "AGENT_UNAVAILABLE" } });
    expect(store.getSnapshot("018f0000-0000-7000-8000-000000000002")).toEqual({});
    expect(updates).toBe(1);
    unsubscribe();
  });

  it("ignores malformed node-state payloads", () => {
    const store = new RunStateStore();
    store.accept(event("018f0000-0000-7000-8000-000000000001", { nodeId: "implement", status: "unknown" }));
    expect(store.getSnapshot("018f0000-0000-7000-8000-000000000001")).toEqual({});
  });
});
