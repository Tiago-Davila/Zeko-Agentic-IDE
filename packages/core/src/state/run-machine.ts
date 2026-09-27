import type { NodeStatus, RunStatus } from "@zeko/contracts";
import { isTerminalNodeStatus } from "./node-machine.js";

export type RunOutcome = "all_succeeded" | "some_not_succeeded";

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return from === "running" && ["finished", "cancelled", "interrupted"].includes(to);
}

export function transitionRun(from: RunStatus, to: RunStatus): RunStatus {
  if (!canTransitionRun(from, to)) throw new Error(`Invalid run transition: ${from} -> ${to}`);
  return to;
}

export function calculateRunOutcome(statuses: NodeStatus[]): RunOutcome | undefined {
  if (statuses.some((status) => !isTerminalNodeStatus(status))) return undefined;
  return statuses.every((status) => status === "completed" || status === "approved") ? "all_succeeded" : "some_not_succeeded";
}

export function finishRun(statuses: NodeStatus[]): { status: "finished"; outcome: RunOutcome } | undefined {
  const outcome = calculateRunOutcome(statuses);
  return outcome ? { status: "finished", outcome } : undefined;
}
