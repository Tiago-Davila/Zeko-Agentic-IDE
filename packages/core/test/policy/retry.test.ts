import { describe, expect, it } from "vitest";
import { decideRetry } from "../../src/policy/retry.js";

describe("retry policy", () => {
  it("retries process errors within maxRetries, but not limits, reports, cancellation, or spawn failures", () => {
    expect(decideRetry({ kind: "agent_error", exitCode: 1, durationMs: 1 }, 1, 0, 0)).toMatchObject({ retry: true, kind: "agent" });
    expect(decideRetry({ kind: "crashed", durationMs: 1 }, 1, 1, 0).retry).toBe(false);
    expect(decideRetry({ kind: "turn_limit", limit: 4, durationMs: 1 }, 4, 0, 0).retry).toBe(false);
    expect(decideRetry({ kind: "killed", by: "timeout", phase: "tree_kill", durationMs: 1 }, 4, 0, 0).retry).toBe(false);
    expect(decideRetry({ kind: "spawn_failed", cause: "not_found", detail: "missing", durationMs: 0 }, 4, 0, 0).retry).toBe(false);
  });
  it("gives infra failures two independent relaunches with the documented delays", () => {
    const outcome = { kind: "infra_failure" as const, cause: "process_create" as const, detail: "267", durationMs: 1 };
    expect(decideRetry(outcome, 0, 0, 0)).toMatchObject({ retry: true, kind: "infra_retry", delayMs: 2_000 });
    expect(decideRetry(outcome, 0, 0, 1)).toMatchObject({ retry: true, kind: "infra_retry", delayMs: 5_000 });
    expect(decideRetry(outcome, 5, 0, 2)).toMatchObject({ retry: false, exhaustedInfrastructure: true });
  });
});
