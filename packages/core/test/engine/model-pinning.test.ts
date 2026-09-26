import { describe, expect, it } from "vitest";
import { makeEngine, flow, report } from "./helpers.js";

describe("RunEngine model pinning", () => {
  it("passes the configured model to launches and records mismatches as warnings", async () => {
    const { engine, adapter } = makeEngine([
      { events: [{ type: "model_mismatch", ts: "2026-01-01T00:00:01.000Z", attemptId: "018f0000-0000-7000-8000-000000000099", requested: "opus", effective: "sonnet" }], outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
    ]);
    const result = await engine.execute();
    expect(adapter.launches[0]?.spec.model).toEqual({ model: "opus" });
    expect(result.nodeRuns.get("a")?.warnings).toContain("MODEL_MISMATCH");
    expect(result.nodeRuns.get("a")?.model?.effective).toBe("sonnet");
    expect(result.nodeRuns.get("a")?.status).toBe("completed");
  });

  it("pins the project default and warns when the node has no model entry", async () => {
    const nodes = flow.nodes.map((node) => {
      if (node.id !== "a" || node.type !== "agent") return node;
      const withoutModels = { ...node };
      delete withoutModels.models;
      return withoutModels;
    });
    const { engine, adapter } = makeEngine([
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
    ], { flow: { ...flow, nodes } });
    const result = await engine.execute();
    expect(adapter.launches[0]?.spec.model).toEqual({ model: "sonnet" });
    expect(result.nodeRuns.get("a")?.warnings).toContain("MODEL_DEFAULTED");
  });
});
