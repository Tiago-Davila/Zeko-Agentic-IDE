import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 6: completed report with blockers", () => {
  it("blocks and records the inconsistency", () => {
    expect(resolveNodeResult(baseInput({ report: { status: "COMPLETED", summary: "done", filesChanged: [], checks: [], blockers: ["missing prerequisite"], findings: [] } }))).toMatchObject({ status: "blocked", reason: { code: "REPORTED_COMPLETED_WITH_BLOCKERS" }, inconsistency: "COMPLETED_WITH_BLOCKERS" });
  });
});
