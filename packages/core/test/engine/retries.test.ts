import { describe, expect, it } from "vitest";
import { makeEngine, report } from "./helpers.js";

describe("RunEngine retries", () => {
  it("retries agent errors in a fresh workspace", async () => {
    const { engine, adapter, clock } = makeEngine([
      { outcome: { kind: "agent_error", exitCode: 1, durationMs: 1 }, report: { state: "absent" } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 2 }, report: { state: "valid", report } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
    ]);
    const result = await engine.execute();
    expect(adapter.launches[0]?.spec.workspacePath).not.toBe(adapter.launches[1]?.spec.workspacePath);
    expect(result.nodeRuns.get("a")?.status).toBe("completed");
    expect(clock.sleeps).toEqual([0]);
  });

  it("allows two infrastructure retries even when maxRetries is zero", async () => {
    const infra = { kind: "infra_failure" as const, cause: "process_create" as const, detail: "267", durationMs: 1 };
    const { engine, adapter, clock } = makeEngine([
      { outcome: infra }, { outcome: infra },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
    ], { maxRetries: 0 });
    const result = await engine.execute();
    expect(adapter.launches.slice(0, 3).map(({ kind }) => kind)).toEqual(["launch", "launch", "launch"]);
    expect(result.nodeRuns.get("a")?.attempts.map(({ kind }) => kind)).toEqual(["agent", "infra_retry", "infra_retry"]);
    expect(clock.sleeps).toEqual([2_000, 5_000]);
  });

  it("fails with INFRA_FAILURE_EXHAUSTED after the two relaunches", async () => {
    const infra = { kind: "infra_failure" as const, cause: "process_create" as const, detail: "267", durationMs: 1 };
    const { engine, adapter } = makeEngine([{ outcome: infra }, { outcome: infra }, { outcome: infra }], { maxRetries: 0 });
    const result = await engine.execute();
    expect(adapter.launches).toHaveLength(3);
    expect(result.nodeRuns.get("a")?.reason?.code).toBe("INFRA_FAILURE_EXHAUSTED");
  });
});
