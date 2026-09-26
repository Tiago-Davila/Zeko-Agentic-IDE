import type { LaunchSpec } from "@zeko/contracts";

export interface CodexInvocationOptions {
  readonly outputSchemaPath: string;
  readonly windowsSandbox: "elevated" | "unelevated";
}

const disabledFeatures = ["apps", "plugins", "image_generation", "multi_agent", "goals", "browser_use", "computer_use"] as const;

/** Builds a non-shell, workspace-write Codex exec invocation with account integrations disabled. */
export function buildCodexArgs(spec: LaunchSpec, options: CodexInvocationOptions): string[] {
  if (spec.agentId !== "codex") throw new Error("Codex requires a codex LaunchSpec");
  if (!("reasoningEffort" in spec.model)) throw new Error("Codex requires an explicit model and reasoning effort");
  const args = [
    "exec", "--json", "--ignore-user-config", "--ignore-rules",
    "-m", spec.model.model,
    "-c", `model_reasoning_effort="${spec.model.reasoningEffort}"`,
  ];
  if (spec.platform === "win32") args.push("-c", `windows.sandbox="${options.windowsSandbox}"`);
  args.push(
    "-s", "workspace-write",
    "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true",
    "-c", "sandbox_workspace_write.exclude_slash_tmp=true",
    "--output-schema", options.outputSchemaPath,
  );
  for (const feature of disabledFeatures) args.push("--disable", feature);
  args.push("-c", 'web_search="disabled"', "-");
  return args;
}
