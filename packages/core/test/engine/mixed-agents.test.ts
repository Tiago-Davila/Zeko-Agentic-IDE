import { describe, expect, it } from "vitest";
import type { FlowFile } from "@zeko/contracts";
import { CODEX_LIKE_CAPABILITIES, ScriptedAdapter } from "@zeko/testing";
import { flow, makeEngine, report } from "./helpers.js";

const mixedFlow: FlowFile = {
  ...flow,
  nodes: flow.nodes.map((node) => node.id === "b" && node.type === "agent"
    ? { ...node, agent: "codex" as const, models: { codex: { model: "gpt-test", reasoningEffort: "medium" } } }
    : node),
};

describe("mixed agent flow", () => {
  it("uses the same result rules and predecessor shape across Claude and Codex", async () => {
    const { engine } = makeEngine([
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1, cost: { amountUsd: 0.2, basis: "billed" } }, report: { state: "valid", report } },
    ], {
      flow: mixedFlow,
      additionalAdapters: {
        codex: new ScriptedAdapter({
          id: "codex", capabilities: CODEX_LIKE_CAPABILITIES,
          executions: [{
            events: [{ type: "inferred_denial", ts: "2026-01-01T00:00:02.000Z", attemptId: "018f0000-0000-7000-8000-000000000099", source: "agent_policy", message: "blocked by policy", target: "outside" }],
            outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report },
          }],
        }),
      },
    });
    const result = await engine.execute();
    expect(result.nodeRuns.get("a")?.status).toBe("completed");
    expect(result.nodeRuns.get("b")?.status).toBe("completed");
    expect(result.nodeRuns.get("b")?.inferredDenials).toHaveLength(1);
    expect(result.nodeRuns.get("b")?.denialCheck).toBe("not_available");
    expect(result.nodeRuns.get("b")?.attempts[0]?.kind).toBe("agent");
    expect(result.run.totals.partial).toBe(true);
  });
});
