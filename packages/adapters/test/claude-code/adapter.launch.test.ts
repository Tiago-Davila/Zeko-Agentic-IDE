import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { LaunchSpec } from "@zeko/contracts";
import { ClaudeCodeAdapter } from "../../src/claude-code/adapter.ts";

const directories: string[] = [];
const fakeAgentPath = fileURLToPath(new URL("../fake-agent/main.ts", import.meta.url));
const spec = (workspacePath: string): LaunchSpec => ({
  agentId: "claude-code",
  runId: "018f0000-0000-7000-8000-000000000001",
  nodeRunId: "018f0000-0000-7000-8000-000000000002",
  attemptId: "018f0000-0000-7000-8000-000000000003",
  workspacePath,
  model: { model: "claude-sonnet-5" },
  prompt: "Verify fixture replay",
  reportSchema: { type: "object" },
  writeScope: ["**"],
  terminal: { enabled: false, allowedCommands: [] },
  maxTurns: 10,
  platform: process.platform === "win32" ? "win32" : "linux",
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ClaudeCodeAdapter.launch", () => {
  it("replays the real Claude stream-json dialect through fake-agent and the process supervisor", async () => {
    const directory = await temporaryDirectory();
    const scenarioPath = join(directory, "scenario.json");
    await writeFile(scenarioPath, JSON.stringify({ mode: "replay", fixture: "claude/q1-verbose-raw.jsonl" }));
    const adapter = replayAdapter(scenarioPath);
    try {
      const execution = adapter.launch(spec(directory));
      const observed = [];
      for await (const event of execution.events) observed.push(event);
      const completed = await execution.completion;
      expect(execution.rootPid.pid).toBeGreaterThan(0);
      expect(observed.map((event) => event.type)).toContain("subscription_usage");
      expect(completed.outcome).toMatchObject({ kind: "exited", sessionId: "78f45a53-1c72-4d74-ac73-e0e893de0922" });
      expect(completed.report).toEqual({ state: "absent" });
    } finally {
      await adapter.dispose();
    }
  }, 20_000);

  it("requests a missing report by forking the previous session from the same workspace", async () => {
    const directory = await temporaryDirectory();
    const scenarioPath = join(directory, "scenario.json");
    await writeFile(scenarioPath, JSON.stringify({ mode: "replay", fixture: "claude/q1-verbose-raw.jsonl" }));
    const adapter = replayAdapter(scenarioPath);
    try {
      const first = adapter.launch(spec(directory));
      await first.completion;
      const report = adapter.requestReport(first, spec(directory));
      const completed = await report.completion;
      expect(report.rootPid.pid).toBeGreaterThan(0);
      expect(completed.outcome).toMatchObject({ kind: "exited", sessionId: "78f45a53-1c72-4d74-ac73-e0e893de0922" });
    } finally {
      await adapter.dispose();
    }
  }, 20_000);

  it("requires an injected command when ZEKO_TEST=1", () => {
    const old = process.env["ZEKO_TEST"];
    process.env["ZEKO_TEST"] = "1";
    try {
      const adapter = new ClaudeCodeAdapter();
      expect(() => adapter.launch(spec(process.cwd()))).toThrow("CLAUDE_BINARY_NOT_INJECTED");
    } finally {
      if (old === undefined) delete process.env["ZEKO_TEST"];
      else process.env["ZEKO_TEST"] = old;
    }
  });
});

function replayAdapter(scenarioPath: string): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter({
    binaryPath: process.execPath,
    prefixArgs: ["--experimental-strip-types", fakeAgentPath, scenarioPath],
  });
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zeko-claude-adapter-"));
  directories.push(directory);
  return directory;
}
