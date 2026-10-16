export type CodexInfrastructureFailure = "process_create" | "session_lock";
export type CodexSignatureResult =
  | { readonly kind: "infra_failure"; readonly cause: CodexInfrastructureFailure }
  | { readonly kind: "inferred_denial" }
  | { readonly kind: "none" };

/** Classifies Codex's known infrastructure signatures before considering its exit code. */
export function classifyCodexSignatures(lines: readonly string[]): CodexSignatureResult {
  const content = lines.join("\n");
  if (/(?:failed:\s*267|os error 267|CreateProcessWithLogonW.{0,200}267|CreateProcessAsUserW.{0,200}267|unified exec.{0,200}267)/iu.test(content)) {
    return { kind: "infra_failure", cause: "process_create" };
  }
  if (/thread-store conflict.{0,160}active writer/iu.test(content)) return { kind: "infra_failure", cause: "session_lock" };
  if (/Rejected\(|blocked by policy|patch rejected|Acceso denegado|Access is denied/iu.test(content)) return { kind: "inferred_denial" };
  return { kind: "none" };
}
