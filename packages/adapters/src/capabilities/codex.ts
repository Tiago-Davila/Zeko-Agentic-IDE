import type { AgentCapabilities, Platform } from "@zeko/contracts";

const codexWindows: AgentCapabilities = {
  terminal: { canDisable: false },
  confinement: { withTerminal: "write_only" },
  writeScopeEnforcement: { unrestricted: "detect", partial: "detect" },
  commandAllowlist: { supported: false, shell: null, readonlyAutoApproved: false },
  reportsDenials: false,
  infersDenials: true,
  supportsTurnLimit: false,
  timeLimit: "engine",
  orderlyInterrupt: false,
  network: "none",
  structuredOutput: true,
  reportRequest: "exec_fork",
  explicitModel: true,
  reportsCost: false,
  reportsConsumption: true,
  subscriptionUsage: "per_node",
  authModes: [{ mode: "subscription", verified: true }, { mode: "api_key", verified: false }],
  infraFailureClasses: ["process_create", "session_lock"],
  processTree: "native_process_tree",
};

export const codexCapabilities: Record<Platform, AgentCapabilities> = {
  win32: codexWindows,
  linux: { ...codexWindows, infraFailureClasses: [], processTree: "process_group" },
};
