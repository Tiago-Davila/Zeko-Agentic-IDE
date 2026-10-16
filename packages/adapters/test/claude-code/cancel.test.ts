import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { LaunchSpec } from "@zeko/contracts";
import { ClaudeCodeAdapter } from "../../src/claude-code/adapter.ts";

const directories: string[] = [];
const fakeAgentPath = fileURLToPath(new URL("../fake-agent/main.ts", import.meta.url));
const attemptId = "018f0000-0000-7000-8000-000000000003";

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ClaudeCodeAdapter.cancel", () => {
  it("uses the interrupt control request and resolves an orderly cancellation", async () => {
    const directory = await temporaryDirectory();
    const adapter = await createAdapter(directory, { hangUntilInterrupt: true, interruptMode: "respond" });
    try {
      const execution = adapter.launch(makeSpec(directory));
      await waitUntilReady(execution);
      await execution.cancel("user");
      const completed = await execution.completion;
      expect(completed.outcome).toMatchObject({ kind: "killed", by: "user", phase: "interrupt" });
    } finally {
      await adapter.dispose();
    }
  }, 20_000);

  it("terminates the registered process tree when the agent ignores interrupt", async () => {
    const directory = await temporaryDirectory();
    const adapter = await createAdapter(directory, { hangUntilInterrupt: true, interruptMode: "ignore", spawnGrandchildSeconds: 15 }, 50);
    try {
      const execution = adapter.launch(makeSpec(directory));
      await waitUntilReady(execution);
      await execution.cancel("timeout");
      const completed = await execution.completion;
      expect(completed.outcome).toMatchObject({ kind: "killed", by: "timeout", phase: "tree_kill" });
    } finally {
      await adapter.dispose();
    }
  }, 20_000);
});

async function createAdapter(directory: string, scenario: Record<string, unknown>, interruptGraceMs = 5_000): Promise<ClaudeCodeAdapter> {
  const scenarioPath = join(directory, "scenario.json");
  await writeFile(scenarioPath, JSON.stringify(scenario));
  return new ClaudeCodeAdapter({
    binaryPath: process.execPath,
    prefixArgs: ["--experimental-strip-types", fakeAgentPath, scenarioPath],
    interruptGraceMs,
  });
}

function makeSpec(workspacePath: string): LaunchSpec {
  return {
    agentId: "claude-code", runId: "018f0000-0000-7000-8000-000000000001", nodeRunId: "018f0000-0000-7000-8000-000000000002",
    attemptId, workspacePath, model: { model: "claude-sonnet-5" }, prompt: "Wait for cancellation", reportSchema: { type: "object" },
    writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] }, maxTurns: 10,
    platform: process.platform === "win32" ? "win32" : "linux",
  };
}

async function waitUntilReady(execution: ReturnType<ClaudeCodeAdapter["launch"]>): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (execution.rootPid.pid === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(execution.rootPid.pid).toBeGreaterThan(0);
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zeko-claude-cancel-"));
  directories.push(directory);
  return directory;
}
