import type { Diagnostic, FlowFile } from "@zeko/contracts";

export function validateLimitsAndScope(flow: Pick<FlowFile, "nodes">, headFiles?: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const node of flow.nodes) {
    if (node.type !== "agent") continue;
    const { limits, writeScope } = node;
    if (!Number.isInteger(limits.timeoutMinutes) || limits.timeoutMinutes < 1 || limits.timeoutMinutes > 1440
      || !Number.isInteger(limits.maxTurns) || limits.maxTurns < 1 || limits.maxTurns > 500
      || !Number.isInteger(limits.maxRetries) || limits.maxRetries < 0 || limits.maxRetries > 5) {
      diagnostics.push({ code: "INVALID_LIMIT", severity: "error", nodeId: node.id, params: { limits } });
    }
    for (const scope of writeScope) {
      if (!isValidGlob(scope)) {
        diagnostics.push({ code: "INVALID_LIMIT", severity: "error", nodeId: node.id, params: { scope, reason: "invalid_write_scope_glob" } });
      } else if (headFiles !== undefined && !headFiles.some((file) => globMatches(scope, file))) {
        diagnostics.push({ code: "SCOPE_PATH_NOT_FOUND", severity: "warning", nodeId: node.id, params: { scope } });
      }
    }
  }
  return diagnostics;
}

export function isValidGlob(pattern: string): boolean {
  if (!pattern || pattern.includes("\\") || pattern.startsWith("/") || /^[A-Za-z]:/.test(pattern) || pattern.split("/").includes("..")) return false;
  let brackets = 0;
  for (const char of pattern) {
    if (char === "[") brackets += 1;
    if (char === "]") { brackets -= 1; if (brackets < 0) return false; }
  }
  return brackets === 0;
}

export function globMatches(pattern: string, path: string): boolean {
  if (!isValidGlob(pattern) || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) return false;
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      index += 1;
      if (pattern[index + 1] === "/") { index += 1; source += "(?:.*/)?"; }
      else source += ".*";
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else if (char === "[") {
      const end = pattern.indexOf("]", index + 1);
      source += pattern.slice(index, end + 1);
      index = end;
    } else source += char?.replace(/[|\\{}()[\]^$+?.]/g, "\\$&") ?? "";
  }
  try { return new RegExp(`${source}$`).test(path); }
  catch { return false; }
}
