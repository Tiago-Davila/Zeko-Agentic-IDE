import { describe, expect, it } from "vitest";
import { claudeCodeCapabilities } from "../src/capabilities/claude-code.js";
import { codexCapabilities } from "../src/capabilities/codex.js";
import { AgentCapabilitiesSchema } from "@zeko/contracts";

const expectedClaude = (shell: "PowerShell" | "Bash", processTree: "windows_process_tree" | "process_group") => ({
  terminal: { canDisable: true },
  confinement: { noTerminal: "full", withTerminal: "none" },
  writeScopeEnforcement: { unrestricted: "prevent", partial: "detect" },
  commandAllowlist: { supported: true, shell, readonlyAutoApproved: true },
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
  processTree,
});

const expectedCodex = (infraFailureClasses: string[], processTree: "native_process_tree" | "process_group") => ({
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
  infraFailureClasses,
  processTree,
});

describe("declared agent capability matrix", () => {
  it("matches the contract matrix for Claude on Windows and Linux", () => {
    expect(AgentCapabilitiesSchema.parse(claudeCodeCapabilities["win32"])).toEqual(expectedClaude("PowerShell", "windows_process_tree"));
    expect(AgentCapabilitiesSchema.parse(claudeCodeCapabilities["linux"])).toEqual(expectedClaude("Bash", "process_group"));
  });

  it("matches the contract matrix for Codex on Windows and Linux", () => {
    expect(AgentCapabilitiesSchema.parse(codexCapabilities["win32"])).toEqual(expectedCodex(["process_create", "session_lock"], "native_process_tree"));
    expect(AgentCapabilitiesSchema.parse(codexCapabilities["linux"])).toEqual(expectedCodex([], "process_group"));
  });
});
