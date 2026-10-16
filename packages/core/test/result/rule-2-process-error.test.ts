import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 2c/2e: process errors and spawn failures", () => {
  it("preserves available process error parameters", () => {
    expect(resolveNodeResult(baseInput({ outcome: { kind: "agent_error", exitCode: 1, terminalReason: "invalid model", stderrCode: "MODEL_INVALID", durationMs: 4 } }))).toMatchObject({ status: "failed", reason: { code: "PROCESS_ERROR", params: { terminalReason: "invalid model", exitCode: 1, stderrCode: "MODEL_INVALID" } } });
    expect(resolveNodeResult(baseInput({ outcome: { kind: "crashed", signal: "SIGTERM", durationMs: 4 } }))).toMatchObject({ status: "failed", reason: { code: "PROCESS_ERROR", params: { terminalReason: "SIGTERM" } } });
  });
  it("maps missing binaries and failed authentication to distinct reason codes", () => {
    expect(resolveNodeResult(baseInput({ outcome: { kind: "spawn_failed", cause: "not_found", detail: "not installed", durationMs: 0 } })).reason?.code).toBe("AGENT_UNAVAILABLE");
    expect(resolveNodeResult(baseInput({ outcome: { kind: "spawn_failed", cause: "not_authenticated", detail: "login required", durationMs: 0 } })).reason?.code).toBe("AGENT_NOT_AUTHENTICATED");
  });
});
