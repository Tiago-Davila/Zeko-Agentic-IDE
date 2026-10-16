import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 5: declared report status", () => {
  it("maps FAILED and BLOCKED from the structured report", () => {
    expect(resolveNodeResult(baseInput({ report: { status: "FAILED", summary: "no", filesChanged: [], checks: [], blockers: [], findings: [] } })).reason?.code).toBe("AGENT_REPORTED_FAILED");
    expect(resolveNodeResult(baseInput({ report: { status: "BLOCKED", summary: "blocked", filesChanged: [], checks: [], blockers: ["permission"], findings: [] } })).reason?.code).toBe("AGENT_REPORTED_BLOCKED");
  });
});
