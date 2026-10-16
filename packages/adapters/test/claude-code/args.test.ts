import { describe, expect, it } from "vitest";
import type { LaunchSpec } from "@zeko/contracts";
import { buildClaudeArgs } from "../../src/claude-code/args.ts";

const baseSpec = (overrides: Partial<LaunchSpec> = {}): LaunchSpec => ({
  agentId: "claude-code",
  runId: "018f0000-0000-7000-8000-000000000001",
  nodeRunId: "018f0000-0000-7000-8000-000000000002",
  attemptId: "018f0000-0000-7000-8000-000000000003",
  workspacePath: "C:/work/node",
  model: { model: "claude-sonnet-5" },
  prompt: "Do the work",
  reportSchema: { type: "object" },
  writeScope: ["src/**"],
  terminal: { enabled: false, allowedCommands: [] },
  maxTurns: 40,
  platform: "win32",
  ...overrides,
});

describe("buildClaudeArgs", () => {
  it("builds the verified writable, non-terminal invocation and always pins the model", () => {
    expect(buildClaudeArgs(baseSpec(), { schemaPath: "C:/state/report.schema.json" })).toEqual([
      "-p", "--output-format", "stream-json", "--verbose", "--input-format", "stream-json",
      "--strict-mcp-config", "--restricted", "--permission-mode", "acceptEdits",
      "--model", "claude-sonnet-5", "--json-schema", "C:/state/report.schema.json",
      "--max-turns", "42", "--tools", "Read,Write,Edit,Glob,Grep", "--allowedTools",
      "Read", "Write", "Edit", "Glob", "Grep",
    ]);
  });

  it("keeps empty write scopes read-only", () => {
    const args = buildClaudeArgs(baseSpec({ writeScope: [] }), { schemaPath: "schema.json" });
    expect(args).toContain("Read,Glob,Grep");
    expect(args).not.toContain("Write");
    expect(args).not.toContain("Edit");
  });

  it("removes the unsupported JSON Schema dialect marker for Claude", () => {
    const schema = JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", properties: {} });
    const args = buildClaudeArgs(baseSpec(), { schemaPath: schema });
    const forwarded = JSON.parse(args[args.indexOf("--json-schema") + 1]!) as Record<string, unknown>;
    expect(forwarded).toEqual({ type: "object", properties: {} });
    expect(forwarded).not.toHaveProperty("$schema");
  });

  it("adds the platform shell with only explicitly allowed commands", () => {
    const args = buildClaudeArgs(baseSpec({
      terminal: { enabled: true, allowedCommands: ["git status", "pwsh -File check.ps1"] },
    }), { schemaPath: "schema.json" });
    expect(args).toContain("Read,Write,Edit,Glob,Grep,PowerShell");
    expect(args.slice(args.indexOf("--allowedTools") + 1)).toEqual([
      "Read", "Write", "Edit", "Glob", "Grep", "PowerShell(git status)", "PowerShell(pwsh -File check.ps1)",
    ]);
  });

  it("uses Bash rules on Linux and preserves the bounded turn headroom", () => {
    const args = buildClaudeArgs(baseSpec({ platform: "linux", maxTurns: 3 }), { schemaPath: "/state/schema.json" });
    expect(args).toContain("--max-turns");
    expect(args[args.indexOf("--max-turns") + 1]).toBe("5");
    expect(buildClaudeArgs(baseSpec({ platform: "linux", terminal: { enabled: true, allowedCommands: ["git status"] } }), { schemaPath: "schema.json" }))
      .toContain("Bash(git status)");
  });

  it("can fork a report request without omitting the explicit model", () => {
    const args = buildClaudeArgs(baseSpec(), { schemaPath: "schema.json", resumeSessionId: "session-1" });
    expect(args.slice(-3)).toEqual(["--resume", "session-1", "--fork-session"]);
    expect(args.slice(args.indexOf("--model"), args.indexOf("--model") + 2)).toEqual(["--model", "claude-sonnet-5"]);
  });

  it("never enables permission bypasses or disables structured output", () => {
    const args = buildClaudeArgs(baseSpec(), { schemaPath: "schema.json" });
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--disallowedTools");
    expect(args).not.toContain("dontAsk");
  });
});
