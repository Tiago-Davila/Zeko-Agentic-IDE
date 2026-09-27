import { describe, expect, it } from "vitest";
import { makeEngine, report } from "./helpers.js";

describe("RunEngine basic flow", () => {
  it("completes input immediately and starts dependent nodes in order", async () => {
    const { engine, adapter, store, slots } = makeEngine([
      { events: [{ type: "assistant_text", ts: "2026-01-01T00:00:01.000Z", attemptId: "018f0000-0000-7000-8000-000000000099", text: "first" }], outcome: { kind: "exited", exitCode: 0, durationMs: 4 }, report: { state: "valid", report } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 5 }, report: { state: "valid", report } },
    ]);
    const result = await engine.execute();
    expect(result.run.status).toBe("finished");
    expect(result.run.outcome).toBe("all_succeeded");
    expect(result.nodeRuns.get("goal")?.status).toBe("completed");
    expect(result.nodeRuns.get("a")?.status).toBe("completed");
    expect(result.nodeRuns.get("b")?.status).toBe("completed");
    expect(adapter.launches.map(({ spec }) => spec.prompt.includes("do a") ? "a" : "b")).toEqual(["a", "b"]);
    expect(adapter.launches[1]?.spec.prompt).toContain('"nodeId": "a"');
    expect(store.events.every((event) => event.runId === result.run.id)).toBe(true);
    expect(slots.leases.size).toBe(0);
  });
});
