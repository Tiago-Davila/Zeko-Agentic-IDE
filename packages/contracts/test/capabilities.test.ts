import { describe, expect, it } from "vitest";
import { AgentAvailabilitySchema } from "../src/adapter/availability.js";
import { AgentCapabilitiesSchema } from "../src/adapter/capabilities.js";
import { AgentUsageReadingSchema } from "../src/adapter/usage.js";

const baseCapabilities = {
  terminal: { canDisable: true }, confinement: { noTerminal: "full", withTerminal: "none" },
  writeScopeEnforcement: { unrestricted: "prevent", partial: "detect" },
  commandAllowlist: { supported: true, shell: "PowerShell", readonlyAutoApproved: true },
  reportsDenials: true, infersDenials: false, supportsTurnLimit: true, timeLimit: "engine",
  orderlyInterrupt: true, network: "terminal_only", structuredOutput: true, reportRequest: "resume_fork",
  explicitModel: true, reportsCost: true, reportsConsumption: true, subscriptionUsage: "live",
  authModes: [{ mode: "detect", verified: false }], infraFailureClasses: [], processTree: "windows_process_tree",
};

describe("adapter contract schemas", () => {
  it("validates capability rows", () => {
    expect(AgentCapabilitiesSchema.safeParse(baseCapabilities).success).toBe(true);
  });

  it("rejects personal account fields in AgentAvailability", () => {
    const value = { agentId: "codex", installed: true, auth: { state: "authenticated", mode: "subscription", verified: true }, problems: [], email: "person@example.com" };
    expect(AgentAvailabilitySchema.safeParse(value).success).toBe(false);
  });

  it("bounds reported subscription utilization", () => {
    const value = { agentId: "codex", authMode: "subscription", windows: [{ name: "five_hour", utilization: 0.6 }], readAt: "2026-01-01T00:00:00Z", live: false, source: "rollout" };
    expect(AgentUsageReadingSchema.safeParse(value).success).toBe(true);
    expect(AgentUsageReadingSchema.safeParse({ ...value, windows: [{ name: "x", utilization: 1.1 }] }).success).toBe(false);
  });
});
