import type { AgentReport } from "@zeko/contracts";
import { globMatches } from "../validation/limits-and-scope.js";

export interface FileDiscrepancies {
  undeclared: string[];
  declaredNotObserved: string[];
  scopeViolations: string[];
  historyRewritten: boolean;
}

export interface ObservedFilePath { path: string }

export function normalizeRepoPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^(?:\.\/)+/, "").replace(/\/{2,}/g, "/");
}

export function calculateDiscrepancies(input: {
  observedFiles: ObservedFilePath[];
  report?: AgentReport;
  writeScope: string[];
  historyRewritten?: boolean;
}): FileDiscrepancies {
  const observed = [...new Set(input.observedFiles.map(({ path }) => normalizeRepoPath(path)))].sort();
  const declared = [...new Set((input.report?.filesChanged ?? []).map(normalizeRepoPath))].sort();
  const observedSet = new Set(observed);
  const declaredSet = new Set(declared);
  return {
    undeclared: observed.filter((path) => !declaredSet.has(path)),
    declaredNotObserved: declared.filter((path) => !observedSet.has(path)),
    scopeViolations: observed.filter((path) => !input.writeScope.some((pattern) => globMatches(pattern, path))),
    historyRewritten: input.historyRewritten ?? false,
  };
}
