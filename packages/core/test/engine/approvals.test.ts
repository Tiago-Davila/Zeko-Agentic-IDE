import { describe, expect, it } from "vitest";
import type { FlowFile } from "@zeko/contracts";
import { flow, makeEngine, report } from "./helpers.js";

const approvalFlow: FlowFile = {
  ...flow,
  nodes: [
    flow.nodes[0]!, flow.nodes[1]!,
    { id: "review", type: "approval", position: { x: 1, y: 1 } },
    flow.nodes[2]!,
    { id: "independent", type: "agent", position: { x: 3, y: 1 }, agent: "claude-code", models: { "claude-code": { model: "sonnet" } }, instructions: "independent", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 5, maxTurns: 10, maxRetries: 0 } },
  ],
  edges: [{ from: "goal", to: "a" }, { from: "a", to: "review" }, { from: "review", to: "b" }, { from: "goal", to: "independent" }],
};

describe("RunEngine approvals", () => {
  it("provides predecessor summaries, rejects one branch, and continues independent work", async () => {
    const received: Array<{ nodeId: string; summaryNode: string | undefined }> = [];
    let decide!: (approved: boolean) => void;
    const { engine, store, adapter } = makeEngine([
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
      { outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: { state: "valid", report } },
    ], {
      flow: approvalFlow,
      requestApproval: ({ nodeId, summary }) => {
        received.push({ nodeId, summaryNode: summary[0]?.nodeId });
        return new Promise<boolean>((resolve) => { decide = resolve; });
      },
    });
    const pending = engine.execute();
    for (let i = 0; i < 30 && (adapter.launches.length < 2 || typeof decide !== "function"); i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(adapter.launches).toHaveLength(2);
    decide(false);
    const result = await pending;
    expect(received).toEqual([{ nodeId: "review", summaryNode: "a" }]);
    expect(result.nodeRuns.get("review")?.status).toBe("rejected");
    expect(result.nodeRuns.get("b")?.status).toBe("skipped");
    expect(result.nodeRuns.get("independent")?.status).toBe("completed");
    expect(store.events.some((event) => event.type === "approval.requested")).toBe(true);
    expect(store.events.some((event) => event.type === "approval.decided" && event.payload.decision === "rejected")).toBe(true);
  });
});
