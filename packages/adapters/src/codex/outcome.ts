import { AgentReportSchema, ProcessOutcomeSchema, ReportCandidateSchema, type ProcessOutcome, type ReportCandidate } from "@zeko/contracts";
import type { CodexInfrastructureFailure } from "./signatures.ts";

export function resolveCodexOutcome(input: {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly durationMs: number;
  readonly sessionId?: string;
  readonly completed: boolean;
  readonly failed: boolean;
  readonly finalMessage?: string;
  readonly usage?: ProcessOutcome["consumption"];
  readonly infrastructureFailure?: CodexInfrastructureFailure;
  readonly cancellation?: { readonly by: "user" | "timeout" | "shutdown"; readonly phase: "tree_kill" };
}): { outcome: ProcessOutcome; report: ReportCandidate } {
  const common = { durationMs: input.durationMs, ...(input.sessionId ? { sessionId: input.sessionId } : {}), ...(input.usage ? { consumption: input.usage } : {}) };
  let outcome: unknown;
  if (input.infrastructureFailure) outcome = { ...common, kind: "infra_failure", cause: input.infrastructureFailure, detail: `Codex infrastructure failure: ${input.infrastructureFailure}` };
  else if (input.cancellation) outcome = { ...common, kind: "killed", ...input.cancellation };
  else if (input.failed || (input.exitCode !== null && input.exitCode !== 0 && !input.completed)) outcome = { ...common, kind: "agent_error", exitCode: input.exitCode ?? 1 };
  else if (input.exitCode === 0 && input.completed) outcome = { ...common, kind: "exited", exitCode: 0 };
  else outcome = { ...common, kind: "crashed", ...(input.exitCode === null ? {} : { exitCode: input.exitCode }), ...(input.signal ? { signal: input.signal } : {}) };
  return { outcome: ProcessOutcomeSchema.parse(outcome), report: reportFromMessage(input.finalMessage) };
}

function reportFromMessage(message: string | undefined): ReportCandidate {
  if (message === undefined) return { state: "absent" };
  let value: unknown;
  try { value = JSON.parse(message); } catch { return { state: "absent" }; }
  const parsed = AgentReportSchema.safeParse(value);
  if (parsed.success) return ReportCandidateSchema.parse({ state: "valid", report: parsed.data });
  return ReportCandidateSchema.parse({ state: "invalid", zodErrors: parsed.error.issues.map((issue) => ({ path: issue.path.map((part) => typeof part === "number" ? part : String(part)), code: issue.code, message: issue.message })) });
}
