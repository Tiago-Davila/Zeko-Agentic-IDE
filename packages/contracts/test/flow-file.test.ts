import { describe, expect, it } from "vitest";
import { AgentNodeSchema, validateFlowFile } from "../src/flow-file.js";

const validAgent = {
  id: "work", type: "agent", position: { x: 0, y: 0 }, agent: "claude-code",
  instructions: "Do the task", acceptanceCriteria: [], writeScope: ["src/**"],
  terminal: { enabled: false, allowedCommands: [] },
  limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 1 },
};

describe("FlowFileSchema", () => {
  it("rejects unknown keys instead of accepting secrets", () => {
    const result = validateFlowFile({ schemaVersion: 1, id: "f", name: "Flow", nodes: [], edges: [], apiKey: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("SCHEMA_ERROR");
  });

  it("enforces finite limit ranges", () => {
    expect(AgentNodeSchema.safeParse({ ...validAgent, limits: { ...validAgent.limits, timeoutMinutes: 1441 } }).success).toBe(false);
    expect(AgentNodeSchema.safeParse({ ...validAgent, limits: { ...validAgent.limits, maxRetries: -1 } }).success).toBe(false);
  });

  it("rejects absolute write scopes and parent traversal", () => {
    for (const writeScope of [["../outside"], ["/etc/**"], ["C:/private/**"], ["src\\file"]]) {
      expect(AgentNodeSchema.safeParse({ ...validAgent, writeScope }).success).toBe(false);
    }
  });

  it("requires Codex reasoning effort and rejects it for Claude", () => {
    const codex = AgentNodeSchema.safeParse({ ...validAgent, agent: "codex", models: { codex: { model: "gpt-6-luna" } } });
    expect(codex.success).toBe(false);
    if (!codex.success) expect(codex.error.issues.some((issue) => issue.path.join(".") === "models.codex.reasoningEffort")).toBe(true);
    expect(AgentNodeSchema.safeParse({ ...validAgent, models: { "claude-code": { model: "sonnet", reasoningEffort: "low" } } }).success).toBe(false);
  });
});
