import { describe, expect, it } from "vitest";
import type { FlowFile } from "@zeko/contracts";
import { CLAUDE_LIKE_CAPABILITIES, ScriptedAdapter } from "@zeko/testing";
import { RunEngine } from "../../src/engine/run-engine.js";
import { flow, makeEngine, report } from "./helpers.js";

const branchFlow: FlowFile = { ...flow, edges: [{ from: "goal", to: "a" }, { from: "goal", to: "b" }] };
const usageWindow = { name: "five_hour", utilization: 0.95, resetsAt: "2026-01-01T02:00:00.000Z" };
const highUsage = { agentId: "claude-code" as const, authMode: "detect" as const, windows: [usageWindow], readAt: "2026-01-01T00:00:00.000Z", live: true, source: "scripted" };
const nearUsage = { ...highUsage, windows: [{ ...usageWindow, utilization: 0.85 }] };

describe("RunEngine usage retention", () => {
  it("holds high usage while leaving nodes pending and marks the run held", async () => {
    const { engine, store } = makeEngine([], { flow: branchFlow });
    const gated = new ScriptedAdapter({ capabilities: CLAUDE_LIKE_CAPABILITIES, usage: highUsage });
    const result = await new RunEngine({ ...engine.options, adapters: { "claude-code": gated } }).execute();
    expect(gated.launches).toHaveLength(0);
    expect(result.run.hold).toBe("USAGE_NEAR_LIMIT");
    expect(result.nodeRuns.get("a")?.status).toBe("pending");
    expect(result.nodeRuns.get("a")?.hold).toBe("USAGE_NEAR_LIMIT");
    expect(store.events.some((event) => event.type === "run.held")).toBe(true);
  });

  it("permits at most one branch launch per agent usage reading in the near band", async () => {
    const { engine } = makeEngine([], { flow: branchFlow });
    const gated = new ScriptedAdapter({
      capabilities: CLAUDE_LIKE_CAPABILITIES,
      executions: [{ outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } }], usage: nearUsage,
    });
    const result = await new RunEngine({ ...engine.options, adapters: { "claude-code": gated } }).execute();
    expect(gated.launches).toHaveLength(1);
    expect(result.nodeRuns.get("a")?.status).toBe("completed");
    expect(result.nodeRuns.get("b")?.status).toBe("pending");
    expect(result.nodeRuns.get("b")?.hold).toBe("USAGE_NEAR_LIMIT");
    expect(result.run.hold).toBe("USAGE_NEAR_LIMIT");
  });
});
