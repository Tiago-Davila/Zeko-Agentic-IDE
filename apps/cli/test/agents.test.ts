import { describe, expect, it } from "vitest";
import { agentsCheckCommand } from "../src/commands/agents.js";

describe("zeko agents check", () => {
  it("reports installed/authenticated status without exposing provider emails", async () => {
    const output: string[] = []; let closed = false;
    const createRuntime = (async () => ({
      openProject: async () => ({ projectId: "project", root: "project", flows: [] }),
      agentsStatus: async () => ({ agents: [
        { agentId: "claude-code", installed: true, auth: { state: "authenticated", mode: "subscription", verified: true }, problems: [] },
        { agentId: "codex", installed: false, auth: { state: "unknown", verified: false }, problems: [] },
      ], usage: [] }),
      close: () => { closed = true; },
    })) as never;
    expect(await agentsCheckCommand({ json: true, createRuntime, stdout: (line) => output.push(line) })).toBe(3);
    expect(output[0]).toContain("claude-code"); expect(output[0]).not.toContain("@"); expect(closed).toBe(true);
  });

  it("returns success when every configured agent is available and authenticated", async () => {
    const createRuntime = (async () => ({ openProject: async () => ({ projectId: "p", root: "p", flows: [] }), agentsStatus: async () => ({ agents: [{ agentId: "claude-code", installed: true, auth: { state: "authenticated", verified: true }, problems: [] }], usage: [] }), close() {} })) as never;
    expect(await agentsCheckCommand({ createRuntime, stdout: () => undefined })).toBe(0);
  });
});
