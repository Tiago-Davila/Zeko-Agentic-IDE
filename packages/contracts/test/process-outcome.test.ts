import { describe, expect, it } from "vitest";
import { ProcessOutcomeSchema } from "../src/adapter/process-outcome.js";

describe("ProcessOutcomeSchema", () => {
  it("validates every process outcome variant", () => {
    const cases = [
      { kind: "exited", exitCode: 0 },
      { kind: "agent_error", exitCode: 1 },
      { kind: "turn_limit", limit: 4 },
      { kind: "killed", by: "user", phase: "tree_kill" },
      { kind: "crashed" },
      { kind: "infra_failure", cause: "session_lock", detail: "locked" },
      { kind: "spawn_failed", cause: "not_found", detail: "missing" },
    ];
    for (const value of cases) expect(ProcessOutcomeSchema.safeParse({ ...value, durationMs: 10 }).success).toBe(true);
  });

  it("distinguishes missing denials from an observed empty list", () => {
    const base = { kind: "exited", exitCode: 0, durationMs: 10 };
    expect(ProcessOutcomeSchema.parse(base)).not.toHaveProperty("denials");
    expect(ProcessOutcomeSchema.parse({ ...base, denials: [] }).denials).toEqual([]);
  });
});
