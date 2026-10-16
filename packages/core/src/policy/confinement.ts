import type { AgentCapabilities, WarningCode } from "@zeko/contracts";

export interface DerivedConfinement {
  level: "confined" | "write_only" | "unconfined";
  reason?: "TERMINAL_ENABLED" | "CAN_READ_OUTSIDE_WORKSPACE" | "AGENT_CANNOT_CONFINE";
  effectiveTerminal: boolean;
}

export interface CapabilityPolicy {
  confinement: DerivedConfinement;
  notApplicable: string[];
  warnings: WarningCode[];
}

export function deriveConfinement(capabilities: AgentCapabilities, terminalEnabled: boolean): DerivedConfinement {
  const effectiveTerminal = !capabilities.terminal.canDisable || terminalEnabled;
  if (effectiveTerminal) {
    const terminalLevel = capabilities.confinement.withTerminal;
    if (terminalLevel === "write_only") return { level: "write_only", reason: "CAN_READ_OUTSIDE_WORKSPACE", effectiveTerminal };
    return { level: "unconfined", reason: "TERMINAL_ENABLED", effectiveTerminal };
  }
  if (capabilities.confinement.noTerminal === "full") return { level: "confined", effectiveTerminal };
  if (capabilities.confinement.noTerminal === "write_only") return { level: "write_only", reason: "CAN_READ_OUTSIDE_WORKSPACE", effectiveTerminal };
  return { level: "unconfined", reason: "AGENT_CANNOT_CONFINE", effectiveTerminal };
}

export function deriveCapabilityPolicy(capabilities: AgentCapabilities, terminalEnabled: boolean): CapabilityPolicy {
  const confinement = deriveConfinement(capabilities, terminalEnabled);
  const warnings: WarningCode[] = [];
  if (!capabilities.reportsDenials) warnings.push("DENIAL_CHECK_NOT_AVAILABLE");
  if (!capabilities.supportsTurnLimit) warnings.push("TURN_LIMIT_NOT_APPLICABLE");
  if (capabilities.network === "none") warnings.push("NO_NETWORK_ON_PLATFORM");
  if (!capabilities.reportsCost) warnings.push("COST_NOT_REPORTED");
  if (capabilities.subscriptionUsage !== "live") warnings.push("USAGE_NOT_LIVE");
  if (capabilities.commandAllowlist.readonlyAutoApproved) warnings.push("READONLY_COMMANDS_AUTO_APPROVED");
  if (capabilities.authModes.some(({ mode, verified }) => mode === "api_key" && !verified)) warnings.push("AUTH_API_KEY_UNVERIFIED");
  if (capabilities.writeScopeEnforcement.partial === "detect") warnings.push("SCOPE_ENFORCEMENT_DETECTION_ONLY");
  if (confinement.reason === "AGENT_CANNOT_CONFINE") warnings.push("AGENT_CANNOT_CONFINE");
  const notApplicable: string[] = [];
  if (!capabilities.supportsTurnLimit) notApplicable.push("maxTurns");
  if (!capabilities.commandAllowlist.supported) notApplicable.push("terminal.allowedCommands");
  if (!capabilities.terminal.canDisable) notApplicable.push("terminal.enabled");
  return { confinement, notApplicable, warnings };
}
