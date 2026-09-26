import { describe, expect, it } from "vitest";
import { ProjectConfigSchema, type AgentNode } from "@zeko/contracts";
import { resolveNodeModel } from "../../src/validation/model.js";

const config = ProjectConfigSchema.parse({});
const node = (agent: "claude-code" | "codex", models?: AgentNode["models"]): AgentNode => ({ id: "agent", type: "agent", position: { x: 0, y: 0 }, agent, ...(models ? { models } : {}), instructions: "x", acceptanceCriteria: [], writeScope: [], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 30, maxTurns: 40, maxRetries: 1 } });

describe("resolveNodeModel", () => {
  it("returns the model explicitly configured on the node", () => {
    expect(resolveNodeModel(node("claude-code", { "claude-code": { model: "opus" } }), config)).toMatchObject({ model: "opus", source: "node" });
  });
  it("uses project defaults and warns when this agent has no node entry", () => {
    expect(resolveNodeModel(node("codex"), config)).toMatchObject({ model: "gpt-6-luna", reasoningEffort: "low", source: "project_default", warning: "MODEL_DEFAULTED" });
  });
  it("preserves an entry for another agent without using it as a fallback", () => {
    expect(resolveNodeModel(node("codex", { "claude-code": { model: "opus" } }), config).model).toBe(config.defaultModels.codex?.model);
  });
});
