import { describe, expect, it } from "vitest";
import type { AgentCapabilities } from "@zeko/contracts";
import { deriveCapabilityPolicy, deriveConfinement } from "../../src/policy/confinement.js";

const base: AgentCapabilities = { terminal: { canDisable: true }, confinement: { noTerminal: "full", withTerminal: "none" }, writeScopeEnforcement: { unrestricted: "prevent", partial: "prevent" }, commandAllowlist: { supported: false, shell: null, readonlyAutoApproved: false }, reportsDenials: true, infersDenials: false, supportsTurnLimit: true, timeLimit: "engine", orderlyInterrupt: true, network: "terminal_only", structuredOutput: true, reportRequest: "resume_fork", explicitModel: true, reportsCost: true, reportsConsumption: true, subscriptionUsage: "live", authModes: [], infraFailureClasses: [], processTree: "windows_process_tree" };

describe("capability derived confinement", () => {
  it("derives confined, write_only, and unconfined levels from capabilities", () => {
    expect(deriveConfinement(base, false)).toMatchObject({ level: "confined", effectiveTerminal: false });
    expect(deriveConfinement({ ...base, confinement: { noTerminal: "write_only", withTerminal: "write_only" } }, false)).toMatchObject({ level: "write_only", reason: "CAN_READ_OUTSIDE_WORKSPACE" });
    expect(deriveConfinement(base, true)).toMatchObject({ level: "unconfined", reason: "TERMINAL_ENABLED" });
    expect(deriveConfinement({ ...base, confinement: { withTerminal: "none" } }, false)).toMatchObject({ level: "unconfined", reason: "AGENT_CANNOT_CONFINE" });
  });
  it("derives not applicable fields and every capability warning", () => {
    const profile: AgentCapabilities = { ...base, terminal: { canDisable: false }, confinement: { withTerminal: "write_only" }, writeScopeEnforcement: { unrestricted: "detect", partial: "detect" }, commandAllowlist: { supported: false, shell: null, readonlyAutoApproved: true }, reportsDenials: false, supportsTurnLimit: false, network: "none", reportsCost: false, subscriptionUsage: "per_node", authModes: [{ mode: "api_key", verified: false }] };
    const result = deriveCapabilityPolicy(profile, false);
    expect(result.notApplicable).toEqual(["maxTurns", "terminal.allowedCommands", "terminal.enabled"]);
    expect(result.warnings).toEqual(expect.arrayContaining(["DENIAL_CHECK_NOT_AVAILABLE", "TURN_LIMIT_NOT_APPLICABLE", "NO_NETWORK_ON_PLATFORM", "COST_NOT_REPORTED", "USAGE_NOT_LIVE", "READONLY_COMMANDS_AUTO_APPROVED", "AUTH_API_KEY_UNVERIFIED", "SCOPE_ENFORCEMENT_DETECTION_ONLY"]));
    expect(result.confinement.level).toBe("write_only");
  });
  it("does not warn when denial, turn, cost, usage, and API key checks are available", () => {
    const result = deriveCapabilityPolicy({ ...base, authModes: [{ mode: "api_key", verified: true }] }, false);
    expect(result.warnings).not.toContain("DENIAL_CHECK_NOT_AVAILABLE");
    expect(result.warnings).not.toContain("TURN_LIMIT_NOT_APPLICABLE");
    expect(result.warnings).not.toContain("COST_NOT_REPORTED");
    expect(result.warnings).not.toContain("USAGE_NOT_LIVE");
    expect(result.warnings).not.toContain("AUTH_API_KEY_UNVERIFIED");
  });
});
