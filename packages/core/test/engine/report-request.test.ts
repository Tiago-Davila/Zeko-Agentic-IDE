import { describe, expect, it } from "vitest";
import { makeEngine, report } from "./helpers.js";

describe("RunEngine report request", () => {
  it("requests one missing report on the same logical attempt and workspace", async () => {
    const { engine, adapter } = makeEngine([
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "absent" } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 2 }, report: { state: "valid", report } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
    ]);
    const result = await engine.execute();
    expect(adapter.launches.map(({ kind }) => kind)).toEqual(["launch", "requestReport", "launch"]);
    expect(adapter.launches[0]?.spec.attemptId).toBe(adapter.launches[1]?.spec.attemptId);
    expect(adapter.launches[0]?.spec.workspacePath).toBe(adapter.launches[1]?.spec.workspacePath);
    expect(result.nodeRuns.get("a")?.attempts).toHaveLength(1);
    expect(result.nodeRuns.get("a")?.status).toBe("completed");
  });
});
