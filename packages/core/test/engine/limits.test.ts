import { describe, expect, it } from "vitest";
import { ControllableClock } from "@zeko/testing";
import { makeEngine } from "./helpers.js";

describe("RunEngine time limits", () => {
  it("cancels an attempt at its deadline and resolves it as TIME_LIMIT_EXCEEDED", async () => {
    const clock = new ControllableClock("2026-01-01T00:00:00.000Z", { autoAdvance: false });
    const { engine, adapter } = makeEngine([{ deferCompletion: true }], { clock, enforceTimeouts: true });
    const running = engine.execute();
    for (let i = 0; i < 20 && adapter.launches.length === 0; i += 1) await Promise.resolve();
    expect(adapter.launches).toHaveLength(1);
    clock.advance(5 * 60_000);
    const result = await running;
    expect(adapter.cancellations[0]?.reason).toBe("timeout");
    expect(result.nodeRuns.get("a")?.status).toBe("failed");
    expect(result.nodeRuns.get("a")?.reason?.code).toBe("TIME_LIMIT_EXCEEDED");
  });
});
