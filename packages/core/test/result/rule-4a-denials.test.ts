import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 4a: explicit denials", () => {
  it("blocks only reported denials when the capability supports denial reporting", () => {
    const withoutDenials = baseInput();
    delete withoutDenials.denials;
    expect(resolveNodeResult(withoutDenials).status).toBe("completed");
    expect(resolveNodeResult(baseInput({ denials: [] })).status).toBe("completed");
    expect(resolveNodeResult(baseInput({ denials: [{ tool: "Write", reason: "denied" }] }))).toMatchObject({ status: "blocked", reason: { code: "ACTION_DENIED" } });
    expect(resolveNodeResult(baseInput({ capabilities: { reportsDenials: false, supportsTurnLimit: false }, denials: [{ tool: "Write", reason: "denied" }] }))).toMatchObject({ status: "completed", denialCheck: "not_available" });
    expect(resolveNodeResult(baseInput({ capabilities: { reportsDenials: true, supportsTurnLimit: true }, denials: [], observedFiles: [], report: { status: "COMPLETED", summary: "", filesChanged: [], checks: [], blockers: [], findings: [] } })).denialCheck).toBe("applied");
    const inferredOnly = { ...baseInput(), inferredDenials: [{ source: "agent_policy", message: "inferred" }] };
    expect(resolveNodeResult(inferredOnly).status).toBe("completed");
  });
});
