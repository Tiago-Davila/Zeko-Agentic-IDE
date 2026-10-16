import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 2d: exhausted infrastructure failures", () => {
  it("fails with infrastructure cause after the engine has exhausted retries", () => {
    expect(resolveNodeResult(baseInput({ outcome: { kind: "infra_failure", cause: "session_lock", detail: "locked", durationMs: 1 } }))).toMatchObject({ status: "failed", reason: { code: "INFRA_FAILURE_EXHAUSTED", params: { cause: "session_lock" } } });
  });
});
