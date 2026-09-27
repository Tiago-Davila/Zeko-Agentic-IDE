import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput, completedReport } from "./helpers.js";

describe("rule 2a/2b: execution limits", () => {
  it("fails on timeout regardless of a completed report", () => {
    expect(resolveNodeResult(baseInput({ outcome: { kind: "killed", by: "timeout", phase: "tree_kill", durationMs: 30 }, report: completedReport } )).reason?.code).toBe("TIME_LIMIT_EXCEEDED");
  });
  it("fails on turn limit regardless of a completed report", () => {
    expect(resolveNodeResult(baseInput({ outcome: { kind: "turn_limit", limit: 40, durationMs: 30 }, report: completedReport })).reason).toEqual({ code: "TURN_LIMIT_EXCEEDED", params: { limit: 40 } });
  });
});
