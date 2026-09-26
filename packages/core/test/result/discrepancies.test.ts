import { describe, expect, it } from "vitest";
import { calculateDiscrepancies, normalizeRepoPath } from "../../src/result/discrepancies.js";
import { completedReport } from "./helpers.js";

describe("file discrepancies", () => {
  it("normalizes Windows separators and compares observed and declared paths", () => {
    const result = calculateDiscrepancies({
      observedFiles: [{ path: ".\\src\\actual.ts" }, { path: "src\\actual.ts" }, { path: "docs/readme.md" }],
      report: { ...completedReport, filesChanged: ["src/actual.ts", "missing.ts"] },
      writeScope: ["src/**"],
      historyRewritten: true,
    });
    expect(result).toEqual({ undeclared: ["docs/readme.md"], declaredNotObserved: ["missing.ts"], scopeViolations: ["docs/readme.md"], historyRewritten: true });
    expect(normalizeRepoPath(".\\src\\file.ts")).toBe("src/file.ts");
  });
  it("treats an empty write scope as read-only", () => {
    expect(calculateDiscrepancies({ observedFiles: [{ path: "a.txt" }], writeScope: [] }).scopeViolations).toEqual(["a.txt"]);
  });
});
