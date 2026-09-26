import { describe, expect, it } from "vitest";
import type { LaunchSpec } from "@zeko/contracts";
import { buildCodexArgs } from "../../src/codex/args.ts";

const baseSpec = (overrides: Partial<LaunchSpec> = {}): LaunchSpec => ({
  agentId: "codex",
  runId: "018f0000-0000-7000-8000-000000000001",
  nodeRunId: "018f0000-0000-7000-8000-000000000002",
  attemptId: "018f0000-0000-7000-8000-000000000003",
  workspacePath: "C:/work/node",
  model: { model: "gpt-6-luna", reasoningEffort: "low" },
  prompt: "Do the work",
  reportSchema: { type: "object" },
  writeScope: [],
  terminal: { enabled: true, allowedCommands: [] },
  maxTurns: 40,
  platform: "win32",
  ...overrides,
});

describe("buildCodexArgs", () => {
  it("pins the model, effort, elevated Windows sandbox and strict workspace-write settings", () => {
    expect(buildCodexArgs(baseSpec(), { outputSchemaPath: "C:/state/report.schema.json", windowsSandbox: "elevated" })).toEqual([
      "exec", "--json", "--ignore-user-config", "--ignore-rules",
      "-m", "gpt-6-luna", "-c", 'model_reasoning_effort="low"', "-c", 'windows.sandbox="elevated"',
      "-s", "workspace-write", "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true",
      "-c", "sandbox_workspace_write.exclude_slash_tmp=true", "--output-schema", "C:/state/report.schema.json",
      "--disable", "apps", "--disable", "plugins", "--disable", "image_generation", "--disable", "multi_agent",
      "--disable", "goals", "--disable", "browser_use", "--disable", "computer_use", "-c", 'web_search="disabled"', "-",
    ]);
  });

  it("pins unelevated Windows sandboxes without unlocking broad access", () => {
    const args = buildCodexArgs(baseSpec(), { outputSchemaPath: "schema.json", windowsSandbox: "unelevated" });
    expect(args).toContain('windows.sandbox="unelevated"');
    expect(args).toContain("workspace-write");
    expect(args).not.toContain("danger-full-access");
  });

  it("omits the Windows-only sandbox setting on Linux but keeps workspace-write", () => {
    const args = buildCodexArgs(baseSpec({ platform: "linux" }), { outputSchemaPath: "/state/schema.json", windowsSandbox: "unelevated" });
    expect(args).not.toContain("windows.sandbox=\"unelevated\"");
    expect(args).toContain("workspace-write");
  });

  it("never resumes a mutable thread or changes approval policy", () => {
    const args = buildCodexArgs(baseSpec(), { outputSchemaPath: "schema.json", windowsSandbox: "unelevated" });
    expect(args).not.toContain("resume");
    expect(args).not.toContain("approval_policy");
    expect(args).not.toContain("danger-full-access");
    expect(args.at(-1)).toBe("-");
  });

  it("puts unverified report-fork flags behind an explicit option and omits -s", () => {
    const args = buildCodexArgs(baseSpec({ platform: "linux" }), { outputSchemaPath: "schema.json", windowsSandbox: "unelevated", forkThreadId: "thread-123" });
    expect(args.slice(0, 2)).toEqual(["exec", "fork"]);
    expect(args.indexOf("thread-123")).toBeGreaterThan(args.indexOf("--output-schema"));
    expect(args).toContain('sandbox_mode="workspace-write"');
    expect(args).not.toContain("-s");
  });
});
