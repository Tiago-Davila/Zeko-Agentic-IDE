import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_CODES, REASON_CODES, WARNING_CODES } from "../src/codes.js";

describe("contract codes", () => {
  it("keeps every code list unique", () => {
    for (const codes of [REASON_CODES, WARNING_CODES, DIAGNOSTIC_CODES]) {
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it("includes the result and transition reason codes", () => {
    expect(REASON_CODES).toEqual(expect.arrayContaining([
      "WRITE_OUTSIDE_SCOPE", "INFRA_FAILURE_EXHAUSTED", "UPSTREAM_NOT_SUCCEEDED", "RUN_CANCELLED",
    ]));
  });

  it("includes model and scope warnings", () => {
    expect(WARNING_CODES).toEqual(expect.arrayContaining([
      "MODEL_DEFAULTED", "MODEL_MISMATCH", "SCOPE_ENFORCEMENT_DETECTION_ONLY",
    ]));
  });
});
