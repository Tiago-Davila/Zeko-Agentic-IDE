import type { AgentReport, NodeResult, ProcessOutcome, ReasonCode } from "@zeko/contracts";
import type { FileDiscrepancies, ObservedFilePath } from "./discrepancies.js";
import { calculateDiscrepancies } from "./discrepancies.js";

export interface ResolveNodeResultInput {
  cancelledByUser: boolean;
  outcome: ProcessOutcome;
  reportState: "valid" | "invalid" | "absent" | "not_applicable";
  report?: AgentReport;
  denials?: Array<{ tool: string; reason: string; input?: unknown }>;
  capabilities: { reportsDenials: boolean; supportsTurnLimit: boolean };
  observedFiles: ObservedFilePath[];
  writeScope: string[];
  historyRewritten?: boolean;
}

export function resolveNodeResult(input: ResolveNodeResultInput): NodeResult {
  return decideNodeResult(input, calculateDiscrepancies(input));
}

export function resolveNodeResultWithDiscrepancies(input: ResolveNodeResultInput): { result: NodeResult; discrepancies: FileDiscrepancies } {
  const discrepancies = calculateDiscrepancies(input);
  return { result: decideNodeResult(input, discrepancies), discrepancies };
}

function decideNodeResult(input: ResolveNodeResultInput, discrepancies: FileDiscrepancies): NodeResult {
  const denialCheck = input.capabilities.reportsDenials ? "applied" : "not_available";
  const result = (status: NodeResult["status"], code?: ReasonCode, params: Record<string, unknown> = {}): NodeResult => ({
    status,
    ...(code ? { reason: { code, params } } : {}),
    denialCheck,
    ...(status === "blocked" && code === "REPORTED_COMPLETED_WITH_BLOCKERS" ? { inconsistency: "COMPLETED_WITH_BLOCKERS" as const } : {}),
  });

  // Rule 1: explicit user cancellation always takes precedence.
  if (input.cancelledByUser) return result("cancelled", "CANCELLED_BY_USER");

  // Rule 2: process and execution-limit failures precede report contents.
  const outcome = input.outcome;
  if (outcome.kind === "killed" && outcome.by === "timeout") return result("failed", "TIME_LIMIT_EXCEEDED");
  if (outcome.kind === "turn_limit") return result("failed", "TURN_LIMIT_EXCEEDED", { limit: outcome.limit });
  if (outcome.kind === "agent_error") return result("failed", "PROCESS_ERROR", {
    ...(outcome.terminalReason === undefined ? {} : { terminalReason: outcome.terminalReason }),
    exitCode: outcome.exitCode,
    ...(outcome.stderrCode === undefined ? {} : { stderrCode: outcome.stderrCode }),
  });
  if (outcome.kind === "crashed") return result("failed", "PROCESS_ERROR", {
    ...(outcome.signal === undefined ? {} : { terminalReason: outcome.signal }),
    ...(outcome.exitCode === undefined ? {} : { exitCode: outcome.exitCode }),
  });
  if (outcome.kind === "infra_failure") return result("failed", "INFRA_FAILURE_EXHAUSTED", { cause: outcome.cause, detail: outcome.detail });
  if (outcome.kind === "spawn_failed") return result("failed", outcome.cause === "not_authenticated" ? "AGENT_NOT_AUTHENTICATED" : "AGENT_UNAVAILABLE", { cause: outcome.cause, detail: outcome.detail });

  // Rule 3: one report request has already been made by the engine.
  if (input.reportState === "absent" || input.reportState === "invalid") {
    return result("failed", input.reportState === "absent" ? "REPORT_MISSING" : "REPORT_INVALID");
  }

  // Rule 4: explicit denials and observed writes outside scope block any agent.
  if (input.capabilities.reportsDenials && (input.denials?.length ?? 0) > 0) return result("blocked", "ACTION_DENIED", { denials: input.denials });
  if (discrepancies.scopeViolations.length > 0) return result("blocked", "WRITE_OUTSIDE_SCOPE", { files: discrepancies.scopeViolations });

  // Rules 5 and 6: trust only the report's structured status fields.
  if (input.report?.status === "FAILED") return result("failed", "AGENT_REPORTED_FAILED");
  if (input.report?.status === "BLOCKED") return result("blocked", "AGENT_REPORTED_BLOCKED");
  if (input.report?.status === "COMPLETED" && input.report.blockers.length > 0) return result("blocked", "REPORTED_COMPLETED_WITH_BLOCKERS");

  // Rule 7: a successful process with no higher-priority failure completes.
  return result("completed");
}

export type { FileDiscrepancies };
