import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveClaudeOutcome } from "../../src/claude-code/outcome.ts";

const root = fileURLToPath(new URL("../fixtures/claude/", import.meta.url));
const json = (path: string): Record<string, unknown> => JSON.parse(readFileSync(`${root}/${path}`, "utf8")) as Record<string, unknown>;

describe("resolveClaudeOutcome", () => {
  it("uses is_error and close status for successful results, and marks list pricing estimated", () => {
    const result = json("events/result.success.json");
    const resolved = resolveClaudeOutcome({ result, close: { exitCode: 0, signal: null }, durationMs: 8500, sessionId: String(result["session_id"]) });
    expect(resolved.outcome).toMatchObject({
      kind: "exited", exitCode: 0, turns: 3, sessionId: result["session_id"],
      cost: { basis: "list_price_estimate" },
      consumption: { inputTokens: 4, outputTokens: 219, cacheReadTokens: 47053, cacheCreationTokens: 11728 },
    });
  });

  it("classifies an invalid model as agent_error even when the subtype says success", () => {
    const invalidModel = json("q3-error-bad-model.json");
    const resolved = resolveClaudeOutcome({
      result: { ...invalidModel, errors: [String(invalidModel["result"])], total_cost_usd: invalidModel["cost_usd"] },
      close: { exitCode: 1, signal: null }, durationMs: 1276,
      stderrLines: [String(invalidModel["stderr"])],
    });
    expect(resolved.outcome).toMatchObject({ kind: "agent_error", exitCode: 1, stderrCode: "unrecognized_model", terminalReason: "api_error" });
  });

  it("maps the explicit max-turn subtype to turn_limit", () => {
    const result = json("events/result.error_during_execution.json");
    const resolved = resolveClaudeOutcome({ result: { ...result, subtype: "error_max_turns" }, close: { exitCode: 1, signal: null }, durationMs: 4000 });
    expect(resolved.outcome).toMatchObject({ kind: "turn_limit" });
  });

  it("treats a missing final result as killed only when Zeko cancelled it", () => {
    const killed = resolveClaudeOutcome({ close: { exitCode: 1, signal: null }, durationMs: 40, cancellation: { by: "user", phase: "tree_kill" } });
    const crashed = resolveClaudeOutcome({ close: { exitCode: 1, signal: null }, durationMs: 40 });
    expect(killed.outcome).toMatchObject({ kind: "killed", by: "user", phase: "tree_kill" });
    expect(crashed.outcome).toMatchObject({ kind: "crashed", exitCode: 1 });
  });

  it("validates only structured_output and never parses free-form result text", () => {
    const valid = resolveClaudeOutcome({
      result: { is_error: false, result: "not JSON", structured_output: { status: "COMPLETED", summary: "ok", filesChanged: [], checks: [], blockers: [], findings: [] } },
      close: { exitCode: 0, signal: null }, durationMs: 1,
    });
    const invalid = resolveClaudeOutcome({
      result: { is_error: false, result: JSON.stringify({ status: "COMPLETED", summary: "should not parse" }) },
      close: { exitCode: 0, signal: null }, durationMs: 1,
    });
    expect(valid.report).toMatchObject({ state: "valid", report: { status: "COMPLETED" } });
    expect(invalid.report).toEqual({ state: "absent" });
  });

  it("reports a present but malformed structured report as invalid", () => {
    const resolved = resolveClaudeOutcome({ result: { is_error: false, structured_output: { status: "DONE" } }, close: { exitCode: 0, signal: null }, durationMs: 1 });
    expect(resolved.report.state).toBe("invalid");
    if (resolved.report.state === "invalid") expect(resolved.report.zodErrors.length).toBeGreaterThan(0);
  });
});
