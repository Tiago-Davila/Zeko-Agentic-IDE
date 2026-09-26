import type { LaunchSpec } from "@zeko/contracts";

export interface ClaudeInvocationOptions {
  readonly schemaPath: string;
  readonly resumeSessionId?: string;
}

/** Builds the verified, non-shell Claude Code invocation for a node attempt. */
export function buildClaudeArgs(spec: LaunchSpec, options: ClaudeInvocationOptions): string[] {
  if (spec.agentId !== "claude-code") throw new Error("Claude Code requires a claude-code LaunchSpec");
  const tools = spec.writeScope.length === 0
    ? ["Read", "Glob", "Grep"]
    : ["Read", "Write", "Edit", "Glob", "Grep"];
  const allowedTools = [...tools];
  if (spec.terminal.enabled) {
    const shell = spec.platform === "win32" ? "PowerShell" : "Bash";
    tools.push(shell);
    if (spec.terminal.allowedCommands.length === 0) allowedTools.push(shell);
    else allowedTools.push(...spec.terminal.allowedCommands.map((command) => `${shell}(${command})`));
  }

  const args = [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--input-format", "stream-json",
    "--strict-mcp-config",
    "--restricted",
    "--permission-mode", "acceptEdits",
    "--model", spec.model.model,
    "--json-schema", options.schemaPath,
    "--max-turns", String((spec.maxTurns ?? 40) + 2),
    "--tools", tools.join(","),
    "--allowedTools", ...allowedTools,
  ];
  if (options.resumeSessionId) args.push("--resume", options.resumeSessionId, "--fork-session");
  return args;
}
