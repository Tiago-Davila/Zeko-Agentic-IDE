import { describe, expect, it } from "vitest";
import type { FlowFile, FlowNode } from "@zeko/contracts";
import { analyzeCodeLineage } from "../../src/validation/code-lineage.js";

const input: FlowNode = { id: "input", type: "input", position: { x: 0, y: 0 }, objective: "goal" };
const agent = (id: string, writeScope: string[] = ["**"]): FlowNode => ({ id, type: "agent", position: { x: 0, y: 0 }, agent: "claude-code", instructions: "work", acceptanceCriteria: [], writeScope, terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 0 } });
const approval: FlowNode = { id: "review", type: "approval", position: { x: 0, y: 0 } };
const flow = (nodes: FlowNode[], edges: FlowFile["edges"]): FlowFile => ({ schemaVersion: 1, id: "test", name: "test", nodes, edges });

describe("code lineage", () => {
  it("rejects two code producing predecessors", () => {
    const result = analyzeCodeLineage(flow([input, agent("a"), agent("b"), agent("c")], [{ from: "input", to: "a" }, { from: "input", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "c" }]));
    expect(result.inputSources.get("c")).toEqual(new Set(["a", "b"]));
    expect(result.diagnostics).toMatchObject([{ code: "MULTIPLE_CODE_SOURCES", nodeId: "c" }]);
  });
  it("carries lineage through approval nodes", () => {
    const result = analyzeCodeLineage(flow([input, agent("a"), approval, agent("b")], [{ from: "input", to: "a" }, { from: "a", to: "review" }, { from: "review", to: "b" }]));
    expect(result.codeSource.get("review")).toEqual(new Set(["a"]));
    expect(result.inputSources.get("b")).toEqual(new Set(["a"]));
  });
  it("does not transmit code through a read only agent", () => {
    const result = analyzeCodeLineage(flow([input, agent("a"), agent("readonly", []), agent("c")], [{ from: "input", to: "a" }, { from: "a", to: "readonly" }, { from: "readonly", to: "c" }]));
    expect(result.codeSource.get("readonly")).toEqual(new Set());
    expect(result.inputSources.get("c")).toEqual(new Set());
  });
  it("flags an approval with multiple sources when an agent depends on it", () => {
    const result = analyzeCodeLineage(flow([input, agent("a"), agent("b"), approval, agent("c")], [{ from: "input", to: "a" }, { from: "input", to: "b" }, { from: "a", to: "review" }, { from: "b", to: "review" }, { from: "review", to: "c" }]));
    expect(result.diagnostics.map(({ nodeId }) => nodeId)).toEqual(expect.arrayContaining(["review", "c"]));
  });
});
