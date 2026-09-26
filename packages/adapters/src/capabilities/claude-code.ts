import type { AgentCapabilities, Platform } from "@zeko/contracts";

const claudeCodeCapabilityRow = {
  terminal: { canDisable: true },
  confinement: { noTerminal: "full", withTerminal: "none" },
  writeScopeEnforcement: { unrestricted: "prevent", partial: "detect" },
  commandAllowlist: { supported: true, shell: "PowerShell", readonlyAutoApproved: true },
  reportsDenials: true,
  infersDenials: false,
  supportsTurnLimit: true,
  timeLimit: "engine",
  orderlyInterrupt: true,
  network: "terminal_only",
  structuredOutput: true,
  reportRequest: "resume_fork",
  explicitModel: true,
  reportsCost: true,
  reportsConsumption: true,
  subscriptionUsage: "live",
  authModes: [{ mode: "detect", verified: false }],
  infraFailureClasses: [],
  processTree: "windows_process_tree",
} as const satisfies AgentCapabilities;

export const claudeCodeCapabilities: Record<Platform, AgentCapabilities> = {
  win32: claudeCodeCapabilityRow,
  linux: { ...claudeCodeCapabilityRow, commandAllowlist: { supported: true, shell: "Bash", readonlyAutoApproved: true }, processTree: "process_group" },
};
