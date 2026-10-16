import { describe, expect, it } from "vitest";
import { calculateDiscrepancies } from "../../src/result/discrepancies.js";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput, completedReport } from "./helpers.js";

describe("NodeResult rule precedence", () => {
  it("lets cancellation win over timeout and report status", () => {
    expect(resolveNodeResult(baseInput({ cancelledByUser: true, outcome: { kind: "killed", by: "timeout", phase: "tree_kill", durationMs: 10 }, report: { ...completedReport, status: "FAILED" } }))).toMatchObject({ status: "cancelled", reason: { code: "CANCELLED_BY_USER" } });
  });
  it("lets process limits and invalid reports win over denials and report declarations", () => {
    expect(resolveNodeResult(baseInput({ outcome: { kind: "turn_limit", limit: 3, durationMs: 10 }, denials: [{ tool: "Write", reason: "denied" }], report: { ...completedReport, status: "FAILED" } })).reason?.code).toBe("TURN_LIMIT_EXCEEDED");
    expect(resolveNodeResult(baseInput({ reportState: "invalid", denials: [{ tool: "Write", reason: "denied" }], observedFiles: [{ path: "outside.txt" }], writeScope: ["src/**"] })).reason?.code).toBe("REPORT_INVALID");
  });
  it("lets explicit denials precede scope violations and both precede report FAILED", () => {
    expect(resolveNodeResult(baseInput({ denials: [{ tool: "Write", reason: "denied" }], observedFiles: [{ path: "outside.txt" }], writeScope: ["src/**"], report: { ...completedReport, status: "FAILED" } })).reason?.code).toBe("ACTION_DENIED");
    expect(resolveNodeResult(baseInput({ observedFiles: [{ path: "outside.txt" }], writeScope: ["src/**"], report: { ...completedReport, status: "FAILED" } })).reason?.code).toBe("WRITE_OUTSIDE_SCOPE");
  });
  it("keeps file declaration mismatches and rewritten history as display data", () => {
    const report = { ...completedReport, filesChanged: ["declared.txt"] };
    const input = baseInput({ report, observedFiles: [{ path: "actual.txt" }], writeScope: ["**"], historyRewritten: true });
    expect(resolveNodeResult(input).status).toBe("completed");
    expect(calculateDiscrepancies(input)).toEqual({ undeclared: ["actual.txt"], declaredNotObserved: ["declared.txt"], scopeViolations: [], historyRewritten: true });
  });
  it("uses capability flags without requiring an agent id", () => {
    const denied = baseInput({ capabilities: { reportsDenials: false, supportsTurnLimit: false }, denials: [{ tool: "Write", reason: "inferred only" }] });
    expect(resolveNodeResult(denied)).toMatchObject({ status: "completed", denialCheck: "not_available" });
  });
});
