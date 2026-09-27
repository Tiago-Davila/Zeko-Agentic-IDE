import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 3: missing or invalid report", () => {
  it("fails when the final report is absent or remains invalid after the extra request", () => {
    const withoutReport = baseInput({ reportState: "absent" });
    delete withoutReport.report;
    expect(resolveNodeResult(withoutReport).reason?.code).toBe("REPORT_MISSING");
    expect(resolveNodeResult(baseInput({ reportState: "invalid" })).reason?.code).toBe("REPORT_INVALID");
  });
});
