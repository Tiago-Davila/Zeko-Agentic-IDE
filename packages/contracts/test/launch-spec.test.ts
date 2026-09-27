import { describe, expect, it } from "vitest";
import { LaunchSpecSchema } from "../src/adapter/launch-spec.js";

const base = {
  agentId: "claude-code",
  runId: "018f47e4-7b3a-7abc-8def-0123456789ab", nodeRunId: "018f47e4-7b3a-7abc-8def-0123456789ac",
  attemptId: "018f47e4-7b3a-7abc-8def-0123456789ad", workspacePath: "/tmp/work", prompt: "Do it",
  reportSchema: {}, writeScope: ["src/**"], terminal: { enabled: false, allowedCommands: [] }, platform: "linux",
};

describe("LaunchSpecSchema", () => {
  it("requires an explicitly resolved model, including Codex effort", () => {
    expect(LaunchSpecSchema.safeParse({ ...base, model: { model: "sonnet" } }).success).toBe(true);
    expect(LaunchSpecSchema.safeParse({ ...base, agentId: "codex", model: { model: "gpt-6-luna", reasoningEffort: "low" } }).success).toBe(true);
    const missingEffort = LaunchSpecSchema.safeParse({ ...base, agentId: "codex", model: { model: "gpt-6-luna" } });
    expect(missingEffort.success).toBe(false);
  });
});
