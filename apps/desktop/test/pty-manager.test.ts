import { describe, expect, it, vi } from "vitest";

vi.mock("node-pty", () => ({ spawn: vi.fn() }));

const { agentCommand, dimension, parseOpenRequest } = await import("../src/main/pty-manager.js");

const valid = { sessionKey: "repo\0node\0claude-code", cwd: "C:\\repo", kind: "claude-code", cols: 120, rows: 30 };

describe("interactive terminal requests", () => {
  it("launches each agent's own CLI with the node model", () => {
    expect(agentCommand({ kind: "claude-code", model: "sonnet" })).toEqual(["claude", "--model", "sonnet"]);
    expect(agentCommand({ kind: "codex", model: "gpt-6-luna", reasoningEffort: "low" })).toEqual(["codex", "-m", "gpt-6-luna", "-c", "model_reasoning_effort=low"]);
    expect(agentCommand({ kind: "shell" })).toBeUndefined();
  });

  it("rejects renderer input that could smuggle shell syntax", () => {
    expect(parseOpenRequest({ ...valid, model: "sonnet[1m]" })).toMatchObject({ model: "sonnet[1m]" });
    expect(() => parseOpenRequest({ ...valid, model: "sonnet; rm -rf ~" })).toThrow();
    expect(() => parseOpenRequest({ ...valid, reasoningEffort: "$(whoami)" })).toThrow();
    expect(() => parseOpenRequest({ ...valid, kind: "bash" })).toThrow();
    expect(() => parseOpenRequest({ ...valid, cwd: 42 })).toThrow();
  });

  it("clamps terminal dimensions to sane integers", () => {
    expect(dimension(0, 80)).toBe(80);
    expect(dimension(12.5, 24)).toBe(24);
    expect(dimension(200, 80)).toBe(200);
    expect(parseOpenRequest({ ...valid, cols: "wide" })).toMatchObject({ cols: 80, rows: 30 });
  });
});
