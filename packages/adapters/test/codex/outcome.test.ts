import { describe, expect, it } from "vitest";
import { resolveCodexOutcome } from "../../src/codex/outcome.ts";

const validReport = JSON.stringify({ status: "COMPLETED", summary: "ok", filesChanged: [], checks: [], blockers: [], findings: [] });
const base = { exitCode: 0, signal: null, durationMs: 120, completed: true, failed: false, finalMessage: validReport } as const;

describe("Codex process outcome", () => {
  it("requires both exit zero and turn.completed for success and validates the last agent message", () => {
    expect(resolveCodexOutcome(base)).toMatchObject({ outcome: { kind: "exited", exitCode: 0 }, report: { state: "valid" } });
    expect(resolveCodexOutcome({ ...base, completed: false })).toMatchObject({ outcome: { kind: "crashed" } });
  });
  it("classifies failed turns and infra signatures before exit status", () => {
    expect(resolveCodexOutcome({ ...base, failed: true })).toMatchObject({ outcome: { kind: "agent_error" } });
    expect(resolveCodexOutcome({ ...base, infrastructureFailure: "process_create" })).toMatchObject({ outcome: { kind: "infra_failure", cause: "process_create" } });
  });
  it("preserves cancellation and crash exit details", () => {
    expect(resolveCodexOutcome({ ...base, cancellation: { by: "user", phase: "tree_kill" } })).toMatchObject({ outcome: { kind: "killed", by: "user" } });
    expect(resolveCodexOutcome({ ...base, exitCode: null, completed: false })).toMatchObject({ outcome: { kind: "crashed" } });
  });
  it("distinguishes absent and invalid structured reports", () => {
    expect(resolveCodexOutcome({ exitCode: 0, signal: null, durationMs: 120, completed: true, failed: false }).report).toEqual({ state: "absent" });
    expect(resolveCodexOutcome({ ...base, finalMessage: "not json" }).report).toEqual({ state: "absent" });
    expect(resolveCodexOutcome({ ...base, finalMessage: "{}" }).report.state).toBe("invalid");
  });
});
