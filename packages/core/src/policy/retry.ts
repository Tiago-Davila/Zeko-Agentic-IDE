import type { ProcessOutcome } from "@zeko/contracts";

export const INFRA_RETRY_DELAYS_MS = [2_000, 5_000] as const;

export interface RetryDecision {
  retry: boolean;
  kind?: "agent" | "infra_retry";
  delayMs?: number;
  exhaustedInfrastructure?: boolean;
}

export function decideRetry(outcome: ProcessOutcome, maxRetries: number, agentRetriesUsed: number, infraRetriesUsed: number): RetryDecision {
  if (outcome.kind === "infra_failure") {
    const delayMs = INFRA_RETRY_DELAYS_MS[infraRetriesUsed];
    return delayMs === undefined
      ? { retry: false, exhaustedInfrastructure: true }
      : { retry: true, kind: "infra_retry", delayMs };
  }
  if ((outcome.kind === "agent_error" || outcome.kind === "crashed") && agentRetriesUsed < maxRetries) {
    return { retry: true, kind: "agent", delayMs: 0 };
  }
  return { retry: false };
}
