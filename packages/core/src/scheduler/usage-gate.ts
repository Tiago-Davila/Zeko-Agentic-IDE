import type { AgentUsageReading } from "@zeko/contracts";

export interface UsageGateDecision {
  held: boolean;
  nearLimit: boolean;
  utilization?: number;
  reason?: "USAGE_NEAR_LIMIT";
}

/** Enforces the hard threshold and one-launch-per-reading soft band per agent. */
export class UsageGate {
  readonly #launches = new Map<string, number>();

  check(agentId: string, reading: AgentUsageReading | undefined, threshold: number, now: string): UsageGateDecision {
    if (!reading) return { held: false, nearLimit: false };
    const active = reading.windows.filter((window) => !window.resetsAt || Date.parse(window.resetsAt) > Date.parse(now));
    if (active.length === 0) return { held: false, nearLimit: false };
    const utilization = Math.max(...active.map(({ utilization: value }) => value));
    const key = `${agentId}:${reading.readAt}`;
    if (utilization >= threshold) return { held: true, nearLimit: false, utilization, reason: "USAGE_NEAR_LIMIT" };
    const nearLimit = utilization >= 0.8;
    if (!nearLimit) return { held: false, nearLimit: false, utilization };
    const launches = this.#launches.get(key) ?? 0;
    if (launches >= 1) return { held: true, nearLimit: true, utilization, reason: "USAGE_NEAR_LIMIT" };
    this.#launches.set(key, launches + 1);
    return { held: false, nearLimit: true, utilization };
  }
}

export function usageGate(reading: AgentUsageReading | undefined, threshold: number, now: string): UsageGateDecision {
  if (!reading) return { held: false, nearLimit: false };
  const active = reading.windows.filter((window) => !window.resetsAt || Date.parse(window.resetsAt) > Date.parse(now));
  if (active.length === 0) return { held: false, nearLimit: false };
  const utilization = Math.max(...active.map(({ utilization: value }) => value));
  return utilization >= threshold
    ? { held: true, nearLimit: false, utilization, reason: "USAGE_NEAR_LIMIT" }
    : { held: false, nearLimit: utilization >= 0.8, utilization };
}
