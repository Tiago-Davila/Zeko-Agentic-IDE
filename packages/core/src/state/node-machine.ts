import type { NodeStatus } from "@zeko/contracts";

export type NodeKind = "input" | "agent" | "approval";

const terminal = new Set<NodeStatus>(["approved", "rejected", "completed", "blocked", "failed", "cancelled", "skipped", "interrupted"]);

export function isTerminalNodeStatus(status: NodeStatus): boolean { return terminal.has(status); }

export function canTransitionNode(from: NodeStatus, to: NodeStatus, kind: NodeKind = "agent"): boolean {
  if (from === to && from === "running") return kind === "agent"; // retry attempt
  if (from === "pending") {
    if (to === "skipped") return true;
    if (to === "completed") return kind === "input";
    if (to === "running") return kind === "agent";
    if (to === "waiting_approval") return kind === "approval";
    return false;
  }
  if (from === "running") return kind === "agent" && ["completed", "blocked", "failed", "cancelled", "interrupted"].includes(to);
  if (from === "waiting_approval") return kind === "approval" && ["approved", "rejected", "cancelled", "interrupted"].includes(to);
  return false;
}

export function transitionNode(from: NodeStatus, to: NodeStatus, kind: NodeKind = "agent"): NodeStatus {
  if (!canTransitionNode(from, to, kind)) throw new Error(`Invalid ${kind} node transition: ${from} -> ${to}`);
  return to;
}
