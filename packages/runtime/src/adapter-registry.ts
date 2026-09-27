import type { AgentAdapter, AgentId } from "@zeko/contracts";

/** Isolated map owned by the runtime; adapters remain injectable for CLI and desktop alike. */
export function createAdapterRegistry(adapters: Partial<Record<AgentId, AgentAdapter>> = {}): Partial<Record<AgentId, AgentAdapter>> {
  const registry: Partial<Record<AgentId, AgentAdapter>> = {};
  for (const [key, adapter] of Object.entries(adapters) as Array<[AgentId, AgentAdapter | undefined]>) {
    if (!adapter) continue;
    if (adapter.id !== key) throw new Error(`Adapter registry key ${key} does not match adapter id ${adapter.id}`);
    registry[key] = adapter;
  }
  return registry;
}

export const IPC_METHODS = [
  "project.open", "flow.list", "flow.load", "flow.create", "flow.save", "flow.delete", "flow.validate", "flow.validateEdge",
  "agents.status", "run.preflight", "run.start", "run.cancel", "node.cancel", "approval.decide", "run.list", "run.get",
  "node.output.page", "node.diff", "workspaces.delete", "settings.get", "settings.set",
  "files.readDir", "files.list", "files.search",
] as const;

export const IPC_EVENT_TYPES = ["run.started", "node.state", "node.output", "node.result", "approval.requested", "agent.usage", "run.held", "run.resumed", "run.finished", "flow.fileChanged", "runs.recovered", "engine.error"] as const;
