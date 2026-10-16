import { describe, expect, it } from "vitest";
import type { FlowFile, FlowNode } from "@zeko/contracts";
import { validateGraph } from "../../src/validation/graph.js";

const node = (id: string, type: "input" | "agent" | "approval" = "agent"): FlowNode => type === "input"
  ? { id, type, position: { x: 0, y: 0 }, objective: "goal" }
  : type === "approval" ? { id, type, position: { x: 0, y: 0 } }
  : { id, type, position: { x: 0, y: 0 }, agent: "claude-code", instructions: "do it", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 1 } };
const flow = (nodes: FlowFile["nodes"], edges: FlowFile["edges"] = []): FlowFile => ({ schemaVersion: 1, id: "test", name: "Test", nodes, edges });

describe("validateGraph", () => {
  it("reports no input, multiple inputs, and input predecessors", () => {
    expect(validateGraph(flow([node("a"), node("b")])).map((d) => d.code)).toContain("NO_INPUT_NODE");
    expect(validateGraph(flow([node("a", "input"), node("b", "input")])).map((d) => d.code)).toContain("MULTIPLE_INPUT_NODES");
    expect(validateGraph(flow([node("a", "input"), node("b")], [{ from: "b", to: "a" }])).map((d) => d.code)).toContain("INPUT_HAS_PREDECESSOR");
  });
  it("reports unreachable nodes and approvals without predecessors", () => {
    expect(validateGraph(flow([node("a", "input"), node("b"), node("c", "approval")], [{ from: "a", to: "b" }])).map((d) => d.code)).toEqual(expect.arrayContaining(["DISCONNECTED_NODE", "APPROVAL_WITHOUT_PREDECESSOR"]));
  });
  it("reports missing endpoints and duplicate edges", () => {
    const diagnostics = validateGraph(flow([node("a", "input"), node("b")], [{ from: "a", to: "b" }, { from: "a", to: "b" }, { from: "a", to: "missing" }]));
    expect(diagnostics.filter((d) => d.params["message"] === "Duplicate edge")).toHaveLength(1);
    expect(diagnostics.filter((d) => d.params["message"] === "Edge references an unknown node")).toHaveLength(1);
  });
});
