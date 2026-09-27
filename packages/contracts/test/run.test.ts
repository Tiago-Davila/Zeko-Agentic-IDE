import { describe, expect, it } from "vitest";
import { NodeRunSchema, NodeStatusSchema, RunStatusSchema } from "../src/run.js";

describe("run contracts", () => {
  it("exposes the documented node and run states", () => {
    expect(NodeStatusSchema.options).toContain("interrupted");
    expect(NodeStatusSchema.options).toContain("waiting_approval");
    expect(RunStatusSchema.options).toEqual(["running", "finished", "cancelled", "interrupted"]);
  });

  it("keeps inferred denials separate and preserves absent denial data", () => {
    const base = {
      id: "018f47e4-7b3a-7abc-8def-0123456789ab", runId: "018f47e4-7b3a-7abc-8def-0123456789ac",
      nodeId: "review", nodeType: "agent", status: "running", confinement: { level: "write_only" },
      warnings: [], attempts: [], reportState: "absent", denialCheck: "not_available",
    };
    const parsed = NodeRunSchema.parse(base);
    expect(parsed).not.toHaveProperty("denials");
    expect(NodeRunSchema.parse({ ...base, denials: [] }).denials).toEqual([]);
  });
});
