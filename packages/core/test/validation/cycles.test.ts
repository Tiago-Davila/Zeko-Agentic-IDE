import { describe, expect, it } from "vitest";
import type { FlowFile } from "@zeko/contracts";
import { findCycles, validateCycles, validateEdge } from "../../src/validation/cycles.js";

const nodes = ["a", "b", "c"].map((id) => ({ id, type: "agent" as const, position: { x: 0, y: 0 }, agent: "claude-code" as const, instructions: "x", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 0 } }));
const flow = (edges: FlowFile["edges"]): FlowFile => ({ schemaVersion: 1, id: "test", name: "test", nodes, edges });

describe("cycle validation", () => {
  it("returns the members of each cycle", () => {
    expect(findCycles(flow([{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }]))).toHaveLength(1);
    expect(validateCycles(flow([{ from: "a", to: "b" }, { from: "b", to: "a" }]))[0]?.params["nodeIds"]).toEqual(expect.arrayContaining(["a", "b"]));
  });
  it("rejects only edges that create a cycle", () => {
    expect(validateEdge(flow([{ from: "a", to: "b" }]), { from: "b", to: "c" }).allowed).toBe(true);
    expect(validateEdge(flow([{ from: "a", to: "b" }, { from: "b", to: "c" }]), { from: "c", to: "a" })).toMatchObject({ allowed: false, diagnostic: { code: "CYCLE" } });
    expect(validateEdge(flow([]), { from: "a", to: "missing" })).toMatchObject({ allowed: false, diagnostic: { code: "SCHEMA_ERROR" } });
  });
});
