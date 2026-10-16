import { describe, expect, it } from "vitest";
import { classifyCodexSignatures } from "../../src/codex/signatures.ts";

describe("Codex failure signatures", () => {
  it.each(["failed: 267", "os error 267", "CreateProcessWithLogonW failed 267", "CreateProcessAsUserW failed: 267", "unified exec failed: 267"]) ("classifies %s as process creation infrastructure failure", (line) => {
    expect(classifyCodexSignatures([line])).toEqual({ kind: "infra_failure", cause: "process_create" });
  });
  it("recognizes active session writer conflicts", () => expect(classifyCodexSignatures(["thread-store conflict: active writer"])).toEqual({ kind: "infra_failure", cause: "session_lock" }));
  it.each(["Rejected(path)", "blocked by policy", "patch rejected", "Acceso denegado", "Access is denied"]) ("classifies %s as an inferred denial", (line) => {
    expect(classifyCodexSignatures([line])).toEqual({ kind: "inferred_denial" });
  });
  it("gives the 267 process signature precedence over denial text", () => {
    expect(classifyCodexSignatures(["Access is denied", "CreateProcessWithLogonW failed: 267"])).toEqual({ kind: "infra_failure", cause: "process_create" });
  });
  it("ignores unrelated diagnostics", () => expect(classifyCodexSignatures(["command failed"])).toEqual({ kind: "none" }));
});
