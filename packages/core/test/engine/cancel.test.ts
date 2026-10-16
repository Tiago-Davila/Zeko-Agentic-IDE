import { describe, expect, it } from "vitest";
import { flow, makeEngine, report } from "./helpers.js";

describe("RunEngine cancellation", () => {
  it("cancels active processes and skips pending nodes when cancelling a run", async () => {
    const untrusted: string[] = [];
    const { engine, adapter } = makeEngine([{ deferCompletion: true }], { markWorkspaceUntrusted: async (path) => { untrusted.push(path); } });
    const run = engine.execute();
    for (let i = 0; i < 20 && adapter.launches.length === 0; i += 1) await Promise.resolve();
    await engine.cancelRun();
    const result = await run;
    expect(adapter.cancellations[0]?.reason).toBe("user");
    expect(result.run.status).toBe("cancelled");
    expect(result.nodeRuns.get("a")?.status).toBe("cancelled");
    expect(result.nodeRuns.get("b")?.status).toBe("skipped");
    expect(untrusted).toHaveLength(1);
  });

  it("cancels one running branch while an independent branch completes", async () => {
    const branchedFlow = { ...flow, edges: [{ from: "goal", to: "a" }, { from: "goal", to: "b" }] };
    const { engine, adapter } = makeEngine([
      { deferCompletion: true },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
    ], { flow: branchedFlow });
    const run = engine.execute();
    for (let i = 0; i < 30 && adapter.launches.length < 2; i += 1) await Promise.resolve();
    await engine.cancelNode("a");
    const result = await run;
    expect(result.run.status).toBe("finished");
    expect(result.nodeRuns.get("a")?.status).toBe("cancelled");
    expect(result.nodeRuns.get("b")?.status).toBe("completed");
  });
});
