import type { FlowFile, NodeStatus } from "@zeko/contracts";

export type NextAction =
  | { type: "complete_input"; nodeId: string }
  | { type: "request_approval"; nodeId: string }
  | { type: "run_agent"; nodeId: string }
  | { type: "skip"; nodeId: string; sourceNodeId: string };

export interface SchedulerState {
  statuses: Readonly<Record<string, NodeStatus>>;
}

/** Returns all currently enabled actions in flow order; it never mutates state. */
export function nextActions(flow: Pick<FlowFile, "nodes" | "edges">, state: SchedulerState): NextAction[] {
  const incoming = new Map(flow.nodes.map(({ id }) => [id, [] as string[]]));
  for (const edge of flow.edges) incoming.get(edge.to)?.push(edge.from);
  const actions: NextAction[] = [];
  for (const node of flow.nodes) {
    if (state.statuses[node.id] !== "pending") continue;
    if (node.type === "input") {
      actions.push({ type: "complete_input", nodeId: node.id });
      continue;
    }
    const predecessors = incoming.get(node.id) ?? [];
    const failed = predecessors.find((id) => {
      const status = state.statuses[id];
      return status !== undefined && status !== "pending" && status !== "running" && status !== "waiting_approval" && status !== "completed" && status !== "approved";
    });
    if (failed) {
      actions.push({ type: "skip", nodeId: node.id, sourceNodeId: failed });
      continue;
    }
    if (predecessors.length === 0 || !predecessors.every((id) => ["completed", "approved"].includes(state.statuses[id] ?? ""))) continue;
    actions.push(node.type === "approval"
      ? { type: "request_approval", nodeId: node.id }
      : { type: "run_agent", nodeId: node.id });
  }
  return actions;
}
