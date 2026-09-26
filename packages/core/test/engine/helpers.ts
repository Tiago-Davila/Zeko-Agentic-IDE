import type { AgentAdapter, AgentId, AgentNode, FlowFile, PredecessorResult } from "@zeko/contracts";
import { CLAUDE_LIKE_CAPABILITIES, ControllableClock, InMemoryRunStore, InMemorySlotLeasePort, InMemoryWorkspacePort, ScriptedAdapter } from "@zeko/testing";
import { ProjectConfigSchema } from "@zeko/contracts";
import { RunEngine } from "../../src/engine/run-engine.js";

export const report = { status: "COMPLETED" as const, summary: "done", filesChanged: [], checks: [], blockers: [], findings: [] };
const claudeNode = (id: string): AgentNode => ({
  id, type: "agent", position: { x: 0, y: 0 }, agent: "claude-code", models: { "claude-code": { model: "opus" } },
  instructions: `do ${id}`, acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] },
  limits: { timeoutMinutes: 5, maxTurns: 10, maxRetries: 1 },
});

export const flow: FlowFile = {
  schemaVersion: 1, id: "engine-flow", name: "Engine flow",
  nodes: [
    { id: "goal", type: "input", position: { x: 0, y: 0 }, objective: "Ship this" },
    claudeNode("a"), claudeNode("b"),
  ], edges: [{ from: "goal", to: "a" }, { from: "a", to: "b" }],
};

export function makeEngine(scripts: NonNullable<ConstructorParameters<typeof ScriptedAdapter>[0]["executions"]>, override: { flow?: FlowFile; maxRetries?: number; clock?: ControllableClock; enforceTimeouts?: boolean; additionalAdapters?: Partial<Record<AgentId, AgentAdapter>>; requestApproval?: (request: { nodeId: string; summary: PredecessorResult[] }) => Promise<boolean>; markWorkspaceUntrusted?: (path: string) => Promise<void> } = {}) {
  const adapter = new ScriptedAdapter({ capabilities: CLAUDE_LIKE_CAPABILITIES, executions: scripts });
  const workspace = new InMemoryWorkspacePort();
  const store = new InMemoryRunStore();
  const slots = new InMemorySlotLeasePort();
  const clock = override.clock ?? new ControllableClock();
  let serial = 1;
  const engine = new RunEngine({
    flow: override.flow ?? flow, projectConfig: ProjectConfigSchema.parse({}),
    adapters: { "claude-code": adapter, ...override.additionalAdapters }, workspace, store, slots, clock,
    projectRoot: "/repo", flowFile: ".zeko/flows/engine-flow.flow.yaml", flowHash: "hash", baseCommit: "head",
    platform: "linux", hostPid: 22, hostStartedAt: clock.now(), ...(override.maxRetries === undefined ? {} : { maxRetries: override.maxRetries }),
    enforceTimeouts: override.enforceTimeouts ?? false,
    ...(override.requestApproval ? { requestApproval: override.requestApproval } : {}),
    ...(override.markWorkspaceUntrusted ? { markWorkspaceUntrusted: override.markWorkspaceUntrusted } : {}),
    createId: () => `018f0000-0000-7000-8000-${(serial++).toString(16).padStart(12, "0")}`,
  });
  return { engine, adapter, workspace, store, slots, clock };
}
