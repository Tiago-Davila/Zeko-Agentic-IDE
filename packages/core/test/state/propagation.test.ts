import { describe, expect, it } from "vitest";
import type { FlowFile } from "@zeko/contracts";
import { propagateSkipped } from "../../src/state/propagation.js";

const flow: FlowFile = { schemaVersion: 1, id: "test", name: "test", nodes: ["source", "a", "b", "independent"].map((id) => ({ id, type: "agent" as const, position: { x: 0, y: 0 }, agent: "claude-code" as const, instructions: "x", acceptanceCriteria: [], writeScope: [], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 0 } })), edges: [{ from: "source", to: "a" }, { from: "a", to: "b" }] };

describe("skipped node propagation", () => {
  it("skips pending descendants with the original failed node and preserves independent branches", () => {
    expect(propagateSkipped(flow, { source: "failed", a: "pending", b: "pending", independent: "pending" }, "source")).toEqual([
      { nodeId: "a", status: "skipped", reason: { code: "UPSTREAM_NOT_SUCCEEDED", params: { sourceNodeId: "source" } } },
      { nodeId: "b", status: "skipped", reason: { code: "UPSTREAM_NOT_SUCCEEDED", params: { sourceNodeId: "source" } } },
    ]);
  });
  it("uses rejection and cancellation reasons", () => {
    expect(propagateSkipped(flow, { source: "rejected", a: "pending" }, "source")[0]?.reason.code).toBe("REJECTED_BY_USER");
    expect(propagateSkipped(flow, { source: "cancelled", a: "pending" }, "source")[0]?.reason.code).toBe("RUN_CANCELLED");
  });
});
