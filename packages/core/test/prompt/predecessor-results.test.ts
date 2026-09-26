import { describe, expect, it } from "vitest";
import type { FlowFile, NodeRun } from "@zeko/contracts";
import { buildPredecessorResults } from "../../src/prompt/predecessor-results.js";

const flow: FlowFile = { schemaVersion: 1, id: "test", name: "test", nodes: [
  { id: "input", type: "input", position: { x: 0, y: 0 }, objective: "goal" },
  { id: "agent", type: "agent", position: { x: 0, y: 0 }, agent: "claude-code", instructions: "x", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 1 } },
  { id: "approval", type: "approval", position: { x: 0, y: 0 } },
  { id: "next", type: "agent", position: { x: 0, y: 0 }, agent: "codex", instructions: "y", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 1 } },
], edges: [{ from: "input", to: "agent" }, { from: "agent", to: "approval" }, { from: "approval", to: "next" }] };
const run: NodeRun = { id: "018f0000-0000-7000-8000-000000000001", runId: "018f0000-0000-7000-8000-000000000002", nodeId: "agent", nodeType: "agent", agentId: "claude-code", status: "completed", confinement: { level: "confined" }, warnings: [], attempts: [], reportState: "valid", denialCheck: "applied" };

describe("predecessor results", () => {
  it("passes the results through approval nodes", () => {
    expect(buildPredecessorResults(flow, "next", new Map([["agent", run]])).map(({ nodeId }) => nodeId)).toEqual(["agent"]);
  });
  it("omits predecessors that have not reached a result status", () => {
    expect(buildPredecessorResults(flow, "next", new Map([["agent", { ...run, status: "running" }]])).map(({ nodeId }) => nodeId)).toEqual([]);
  });
});
