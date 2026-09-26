import { describe, expect, it } from "vitest";
import type { FlowFile, FlowNode } from "@zeko/contracts";
import { globMatches, isValidGlob, validateLimitsAndScope } from "../../src/validation/limits-and-scope.js";

const agent: FlowNode = { id: "agent", type: "agent", position: { x: 0, y: 0 }, agent: "claude-code", instructions: "x", acceptanceCriteria: [], writeScope: ["src/**/*.ts"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 0 } };
const flow = (nodes: FlowFile["nodes"]): FlowFile => ({ schemaVersion: 1, id: "test", name: "test", nodes, edges: [] });

describe("limits and write scopes", () => {
  it("rejects invalid finite limits", () => {
    const invalid = { ...agent, limits: { timeoutMinutes: 0, maxTurns: 501, maxRetries: -1 } } as FlowNode;
    expect(validateLimitsAndScope(flow([invalid])).map(({ code }) => code)).toContain("INVALID_LIMIT");
  });
  it("validates relative glob syntax and rejects traversal or absolute paths", () => {
    expect(isValidGlob("src/**/*.ts")).toBe(true);
    expect(isValidGlob("../secret")).toBe(false);
    expect(isValidGlob("/etc/**")).toBe(false);
    expect(isValidGlob("src/[bad")).toBe(false);
    expect(globMatches("src/**/*.ts", "src/lib/file.ts")).toBe(true);
    expect(globMatches("src/*.ts", "src/lib/file.ts")).toBe(false);
  });
  it("emits a warning when a valid scope matches no HEAD file", () => {
    const result = validateLimitsAndScope(flow([agent]), ["README.md"]);
    expect(result).toMatchObject([{ code: "SCOPE_PATH_NOT_FOUND", severity: "warning", nodeId: "agent" }]);
    expect(validateLimitsAndScope(flow([agent]), [])).toMatchObject([{ code: "SCOPE_PATH_NOT_FOUND", severity: "warning" }]);
  });
});
