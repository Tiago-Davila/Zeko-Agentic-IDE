import { describe, expect, it } from "vitest";
import { CLAUDE_LIKE_CAPABILITIES } from "@zeko/testing";
import { ScriptedAdapter } from "@zeko/testing";
import type { FlowFile } from "@zeko/contracts";
import { preflight } from "../src/preflight.js";

const flow = {
  schemaVersion: 1, id: "f", name: "f", edges: [], nodes: [
    { id: "one", type: "agent", position: { x: 0, y: 0 }, agent: "claude-code", instructions: "do", acceptanceCriteria: [], writeScope: [], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 1, maxTurns: 1, maxRetries: 0 } },
  ],
} as FlowFile;

describe("runtime preflight", () => {
  it("checks only used agents and returns the fake detector's auth shape", async () => {
    const result = await preflight(flow, { "claude-code": new ScriptedAdapter({ id: "claude-code", capabilities: CLAUDE_LIKE_CAPABILITIES, availability: { agentId: "claude-code", installed: true, auth: { state: "authenticated", mode: "subscription", verified: true }, problems: [] } }) });
    expect(result.ok).toBe(true); expect(result.perNodeAuth).toEqual([{ nodeId: "one", agentId: "claude-code", state: "authenticated", mode: "subscription", verified: true, installed: true }]);
  });

  it("blocks before callers create a run when an agent is absent or unauthenticated", async () => {
    const result = await preflight(flow, {});
    expect(result.ok).toBe(false); expect(result.missing).toEqual([{ nodeId: "one", agentId: "claude-code", reason: "not_installed" }]);
  });

  it("allows Claude Code when authentication cannot be verified without a free check", async () => {
    const scripted = new ScriptedAdapter({ id: "claude-code", capabilities: CLAUDE_LIKE_CAPABILITIES, availability: {
      agentId: "claude-code", installed: true, auth: { state: "unknown", mode: "detect", verified: false }, problems: [],
    } });
    const result = await preflight(flow, { "claude-code": scripted });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.perNodeAuth[0]).toMatchObject({ state: "unknown", verified: false, installed: true });
  });

  it("does not expose provider problems that can include account email", async () => {
    const scripted = new ScriptedAdapter({ id: "claude-code", capabilities: CLAUDE_LIKE_CAPABILITIES, availability: {
      agentId: "claude-code", installed: true, auth: { state: "not_authenticated", verified: false }, problems: ["signed in as person@example.com"],
    } });
    const result = await preflight(flow, { "claude-code": scripted });
    expect(JSON.stringify(result)).not.toContain("person@example.com"); expect(result.ok).toBe(false);
  });
});
