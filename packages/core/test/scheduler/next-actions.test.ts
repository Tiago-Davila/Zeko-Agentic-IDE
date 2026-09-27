import { describe, expect, it } from "vitest";
import type { FlowFile } from "@zeko/contracts";
import { nextActions } from "../../src/scheduler/next-actions.js";

const flow: FlowFile = {
  schemaVersion: 1, id: "flow", name: "flow",
  nodes: [
    { id: "goal", type: "input", position: { x: 0, y: 0 }, objective: "goal" },
    { id: "a", type: "agent", position: { x: 1, y: 0 }, agent: "claude-code", instructions: "a", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 5, maxTurns: 10, maxRetries: 1 } },
    { id: "b", type: "agent", position: { x: 2, y: 0 }, agent: "codex", instructions: "b", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 5, maxTurns: 10, maxRetries: 1 } },
    { id: "c", type: "agent", position: { x: 2, y: 1 }, agent: "claude-code", instructions: "c", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 5, maxTurns: 10, maxRetries: 1 } },
  ], edges: [{ from: "goal", to: "a" }, { from: "a", to: "b" }, { from: "goal", to: "c" }],
};

describe("nextActions", () => {
  it("completes input nodes and releases independent agents together", () => {
    expect(nextActions(flow, { statuses: { goal: "pending", a: "pending", b: "pending", c: "pending" } })).toEqual([
      { type: "complete_input", nodeId: "goal" },
    ]);
    expect(nextActions(flow, { statuses: { goal: "completed", a: "pending", b: "pending", c: "pending" } })).toEqual([
      { type: "run_agent", nodeId: "a" }, { type: "run_agent", nodeId: "c" },
    ]);
  });
  it("waits for every dependency and skips a dependent of a failed node", () => {
    expect(nextActions(flow, { statuses: { goal: "completed", a: "running", b: "pending", c: "pending" } })).toEqual([
      { type: "run_agent", nodeId: "c" },
    ]);
    expect(nextActions(flow, { statuses: { goal: "completed", a: "failed", b: "pending", c: "completed" } })).toContainEqual({ type: "skip", nodeId: "b", sourceNodeId: "a" });
  });
});
