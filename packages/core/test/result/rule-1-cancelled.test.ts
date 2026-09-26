import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 1: user cancellation", () => {
  it("cancels despite a successful process and completed report", () => {
    expect(resolveNodeResult(baseInput({ cancelledByUser: true }))).toMatchObject({ status: "cancelled", reason: { code: "CANCELLED_BY_USER" } });
  });
  it("completes when none of the higher-priority rules match", () => {
    expect(resolveNodeResult(baseInput())).toMatchObject({ status: "completed", denialCheck: "applied" });
  });
});
