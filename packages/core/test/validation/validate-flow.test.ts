import { describe, expect, it } from "vitest";
import { ProjectConfigSchema, type AgentCapabilities, type FlowFile } from "@zeko/contracts";
import { validateFlow } from "../../src/validation/validate-flow.js";

const capabilities: AgentCapabilities = { terminal: { canDisable: true }, confinement: { noTerminal: "full", withTerminal: "none" }, writeScopeEnforcement: { unrestricted: "prevent", partial: "detect" }, commandAllowlist: { supported: true, shell: "PowerShell", readonlyAutoApproved: true }, reportsDenials: true, infersDenials: false, supportsTurnLimit: false, timeLimit: "engine", orderlyInterrupt: true, network: "terminal_only", structuredOutput: true, reportRequest: "resume_fork", explicitModel: true, reportsCost: true, reportsConsumption: true, subscriptionUsage: "live", authModes: [], infraFailureClasses: [], processTree: "windows_process_tree" };
const flow: FlowFile = { schemaVersion: 1, id: "test", name: "test", nodes: [
  { id: "input", type: "input", objective: "goal", position: { x: 0, y: 0 } },
  { id: "agent", type: "agent", agent: "claude-code", instructions: "work", acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 0 }, position: { x: 0, y: 0 } },
], edges: [{ from: "input", to: "agent" }] };

describe("validateFlow", () => {
  it("combines graph and domain diagnostics without depending on adapters", () => {
    const diagnostics = validateFlow(flow, ProjectConfigSchema.parse({}), { capabilities: { "claude-code": capabilities } });
    expect(diagnostics.map(({ code }) => code)).toContain("OPTION_NOT_APPLICABLE");
    expect(diagnostics.map(({ code }) => code)).toContain("MODEL_DEFAULTED");
    expect(diagnostics.map(({ code }) => code)).not.toContain("SCHEMA_ERROR");
  });
  it("integrates cycles, multiple code sources, and invalid limits", () => {
    const baseAgent = flow.nodes[1];
    if (!baseAgent || baseAgent.type !== "agent") throw new Error("Test fixture is missing its agent");
    const second = { ...baseAgent, id: "second" };
    const final = { ...baseAgent, id: "final", limits: { ...baseAgent.limits, maxRetries: 99 } };
    const invalid: FlowFile = { ...flow, nodes: [...flow.nodes, second, final], edges: [
      { from: "input", to: "agent" }, { from: "input", to: "second" }, { from: "agent", to: "final" }, { from: "second", to: "final" },
    ] };
    const diagnostics = validateFlow(invalid, ProjectConfigSchema.parse({}));
    expect(diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining(["MULTIPLE_CODE_SOURCES", "INVALID_LIMIT"]));
    const cyclic = { ...invalid, edges: [...invalid.edges, { from: "final", to: "agent" }] };
    expect(validateFlow(cyclic, ProjectConfigSchema.parse({})).map(({ code }) => code)).toContain("CYCLE");
  });
});
