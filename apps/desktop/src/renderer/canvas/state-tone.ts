import type { NodeStatus } from "@zeko/contracts";

export type StateTone = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled" | "blocked";

// Single status-to-colour map shared by the node LED, the status pill and the minimap.
const tones: Record<NodeStatus, StateTone> = {
  pending: "pending",
  running: "running",
  waiting_approval: "waiting",
  approved: "completed",
  rejected: "failed",
  completed: "completed",
  blocked: "blocked",
  failed: "failed",
  cancelled: "cancelled",
  skipped: "cancelled",
  interrupted: "blocked",
};

export function toneOf(status: NodeStatus | undefined): StateTone {
  return status ? tones[status] : "pending";
}
