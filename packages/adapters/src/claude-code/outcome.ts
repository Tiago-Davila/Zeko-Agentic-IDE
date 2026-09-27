import { AgentReportSchema, ProcessOutcomeSchema, ReportCandidateSchema, type ProcessOutcome, type ReportCandidate } from "@zeko/contracts";

export interface ClaudeCloseResult {
  readonly exitCode: number | null;
  readonly signal: string | null;
}

export interface ClaudeCancellation {
  readonly by: "user" | "timeout" | "shutdown";
  readonly phase: "interrupt" | "tree_kill";
}

export interface ClaudeOutcomeResult {
  readonly outcome: ProcessOutcome;
  readonly report: ReportCandidate;
}

/** Resolves outcome and structured report only after both stream result and root close are known. */
export function resolveClaudeOutcome(input: {
  readonly result?: Readonly<Record<string, unknown>>;
  readonly close: ClaudeCloseResult;
  readonly durationMs: number;
  readonly sessionId?: string;
  readonly cancellation?: ClaudeCancellation;
  readonly stderrLines?: readonly string[];
}): ClaudeOutcomeResult {
  const { result, close, durationMs } = input;
  const session = input.sessionId ? { sessionId: input.sessionId } : {};
  const usage = consumption(result);
  const cost = costOf(result);
  const turns = integerValue(result?.["num_turns"]);
  const denials = denialsOf(result);
  const common = {
    durationMs,
    ...session,
    ...(usage ? { consumption: usage } : {}),
    ...(cost ? { cost } : {}),
    ...(turns === undefined ? {} : { turns }),
    ...(denials === undefined ? {} : { denials }),
  };
  const report = reportOf(result?.["structured_output"]);

  let candidate: unknown;
  if (input.cancellation) {
    candidate = { ...common, kind: "killed", ...input.cancellation };
  } else if (!result) {
    candidate = {
      ...common,
      kind: "crashed",
      ...(close.exitCode === null ? {} : { exitCode: close.exitCode }),
      ...(close.signal === null ? {} : { signal: close.signal }),
    };
  } else if (result["subtype"] === "error_max_turns") {
    candidate = { ...common, kind: "turn_limit", limit: numberValue(result["num_turns"]) ?? 1 };
  } else if (result["is_error"] === true || close.exitCode !== 0) {
    const stderrCode = findClaudeStderrCode(input.stderrLines ?? []);
    const errors = stringArray(result["errors"]);
    const terminalReason = stringValue(result["terminal_reason"]);
    const resultText = stringValue(result["result"]);
    candidate = {
      ...common,
      kind: "agent_error",
      exitCode: close.exitCode ?? 1,
      ...(terminalReason ? { terminalReason } : {}),
      ...(errors.length > 0 ? { errors } : resultText ? { errors: [resultText] } : {}),
      ...(stderrCode ? { stderrCode } : {}),
    };
  } else {
    candidate = { ...common, kind: "exited", exitCode: 0 };
  }
  return {
    outcome: ProcessOutcomeSchema.parse(candidate),
    report,
  };
}

export function findClaudeStderrCode(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    const match = /\[claude-code:([^\]]+)\]/u.exec(line);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function reportOf(value: unknown): ReportCandidate {
  if (value === undefined) return { state: "absent" };
  const result = AgentReportSchema.safeParse(value);
  if (result.success) return ReportCandidateSchema.parse({ state: "valid", report: result.data });
  return ReportCandidateSchema.parse({
    state: "invalid",
    zodErrors: result.error.issues.map((issue) => ({ path: issue.path.map((part) => typeof part === "number" ? part : String(part)), code: issue.code, message: issue.message })),
  });
}

function consumption(result: Readonly<Record<string, unknown>> | undefined): ProcessOutcome["consumption"] {
  const usage = asRecord(result?.["usage"]);
  if (!usage) return undefined;
  const cacheCreation = asRecord(usage["cache_creation"]);
  const inputTokens = numberValue(usage["input_tokens"]);
  const outputTokens = numberValue(usage["output_tokens"]);
  const cacheReadTokens = numberValue(usage["cache_read_input_tokens"]);
  const cacheCreationTokens = numberValue(usage["cache_creation_input_tokens"]);
  const consumption = {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheCreationTokens === undefined ? {} : { cacheCreationTokens }),
  };
  if (Object.keys(consumption).length === 0 && !cacheCreation) return undefined;
  return consumption;
}

function costOf(result: Readonly<Record<string, unknown>> | undefined): ProcessOutcome["cost"] {
  const amountUsd = numberValue(result?.["total_cost_usd"]);
  if (amountUsd === undefined || amountUsd < 0) return undefined;
  const modelUsage = asRecord(result?.["modelUsage"]);
  const bases = modelUsage ? Object.values(modelUsage).map((value) => stringValue(asRecord(value)?.["costBasis"])) : [];
  const basis = bases.includes("list") ? "list_price_estimate" : bases.length > 0 && bases.every((value) => value === "none") ? "billed" : "unknown";
  return { amountUsd, basis };
}

function denialsOf(result: Readonly<Record<string, unknown>> | undefined): ProcessOutcome["denials"] {
  if (!Array.isArray(result?.["permission_denials"])) return undefined;
  return result["permission_denials"].flatMap((value) => {
    const denial = asRecord(value);
    if (!denial) return [];
    const tool = stringValue(denial["tool_name"]);
    const reason = stringValue(denial["message"]) ?? stringValue(denial["reason"]);
    if (!tool || !reason) return [];
    return [{ tool, reason, ...(denial["input"] === undefined ? {} : { input: denial["input"] }) }];
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function integerValue(value: unknown): number | undefined {
  const number = numberValue(value);
  return number !== undefined && Number.isInteger(number) && number >= 0 ? number : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
