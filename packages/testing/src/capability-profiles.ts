import type { AgentCapabilities, Platform } from "@zeko/contracts";

const claude = (platform: Platform): AgentCapabilities => ({
  terminal: { canDisable: true },
  confinement: { noTerminal: "full", withTerminal: "none" },
  writeScopeEnforcement: { unrestricted: "prevent", partial: "detect" },
  commandAllowlist: { supported: true, shell: platform === "win32" ? "PowerShell" : "Bash", readonlyAutoApproved: true },
  reportsDenials: true, infersDenials: false, supportsTurnLimit: true, timeLimit: "engine",
  orderlyInterrupt: true, network: "terminal_only", structuredOutput: true,
  reportRequest: "resume_fork", explicitModel: true, reportsCost: true,
  reportsConsumption: true, subscriptionUsage: "live",
  authModes: [{ mode: "detect", verified: false }], infraFailureClasses: [],
  processTree: platform === "win32" ? "windows_process_tree" : "process_group",
});

const codex = (platform: Platform): AgentCapabilities => ({
  terminal: { canDisable: false },
  confinement: { withTerminal: "write_only" },
  writeScopeEnforcement: { unrestricted: "detect", partial: "detect" },
  commandAllowlist: { supported: false, shell: null, readonlyAutoApproved: false },
  reportsDenials: false, infersDenials: true, supportsTurnLimit: false, timeLimit: "engine",
  orderlyInterrupt: false, network: "none", structuredOutput: true,
  reportRequest: "exec_fork", explicitModel: true, reportsCost: false,
  reportsConsumption: true, subscriptionUsage: "per_node",
  authModes: [{ mode: "subscription", verified: true }, { mode: "api_key", verified: false }],
  infraFailureClasses: ["process_create", "session_lock"],
  processTree: platform === "win32" ? "native_process_tree" : "process_group",
});

/** Synthetic profiles mirror the documented Claude and Codex capability families. */
export const CLAUDE_LIKE_CAPABILITIES: Readonly<Record<Platform, AgentCapabilities>> = {
  win32: claude("win32"), linux: claude("linux"),
};
export const CODEX_LIKE_CAPABILITIES: Readonly<Record<Platform, AgentCapabilities>> = {
  win32: codex("win32"), linux: codex("linux"),
};
