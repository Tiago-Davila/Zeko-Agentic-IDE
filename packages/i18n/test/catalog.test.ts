import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_CODES, REASON_CODES, WARNING_CODES } from "@zeko/contracts";
import { en, t } from "../src/index.js";

describe("English text catalog", () => {
  it("contains a message for every contract code", () => {
    for (const code of [...REASON_CODES, ...WARNING_CODES, ...DIAGNOSTIC_CODES]) {
      expect(en[code]).toBeTypeOf("string");
      expect(en[code]?.length).toBeGreaterThan(0);
    }
  });

  it("interpolates parameters without a runtime dependency", () => {
    expect(t("TIME_LIMIT_EXCEEDED", { minutes: 15 })).toContain("15 minutes");
  });
});
