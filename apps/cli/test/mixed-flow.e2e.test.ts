import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../../packages/adapters/src/claude-code/adapter.ts";
import { CodexAdapter } from "../../../packages/adapters/src/codex/adapter.ts";
import { runCommand } from "../src/commands/run.js";
import { runsShowCommand } from "../src/commands/runs.js";

const execFile = promisify(execFileCallback);
const fakeAgent = fileURLToPath(new URL("../../../packages/adapters/test/fake-agent/main.ts", import.meta.url));

describe("CLI mixed Claude and Codex flow", () => {
  it("passes Claude output through approval into Codex, exposes inferred denials, and preserves source history", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-mixed-flow-"));
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    await mkdir(localData, { recursive: true });
    const state = join(localData, `zeko-mixed-state-${process.pid}-${Date.now()}`);
    await mkdir(state, { recursive: true });
    const claudeScenario = join(state, "claude.json");
    const codexScenario = join(state, "codex.json");
    const claude = new ClaudeCodeAdapter({ binaryPath: process.execPath, prefixArgs: ["--experimental-strip-types", fakeAgent, claudeScenario], versionArgs: ["-e", "process.stdout.write('Claude Code 2.1.280')"], authArgs: ["-e", "process.stdout.write('{}')"] });
    const codex = new CodexAdapter({ binaryPath: process.execPath, prefixArgs: ["--experimental-strip-types", fakeAgent, codexScenario], codexHome: join(state, "empty-codex-home"), versionArgs: ["-e", "process.stdout.write('Codex CLI 0.4.12')"], authArgs: ["-e", "process.exit(0)"], platform: process.platform });
    try {
      await git(root, "init", "--quiet"); await git(root, "config", "user.name", "Mixed Flow Test"); await git(root, "config", "user.email", "mixed-flow@example.invalid");
      await writeFile(join(root, "seed.txt"), "original\n", "utf8"); await git(root, "add", "."); await git(root, "commit", "--quiet", "-m", "base");
      const originalHead = await git(root, "rev-parse", "HEAD");
      await mkdir(join(root, ".zeko", "flows"), { recursive: true });
      await writeFile(claudeScenario, JSON.stringify({ mode: "replay", fixture: "claude/e2e-success.jsonl" }));
      await writeFile(codexScenario, JSON.stringify({ mode: "replay", fixture: "codex/events/e2e-report.jsonl", stderrLines: ["patch rejected by policy"], exitCode: 0 }));
      await writeFile(join(root, ".zeko", "flows", "mixed.flow.yaml"), flowYaml());
      const originalStatus = await git(root, "status", "--porcelain");
      const output: string[] = [];
      const errors: string[] = [];
      const exitCode = await runCommand({
        flow: "mixed", project: root, json: true, stdinIsTTY: true,
        approvalPrompt: async () => "approved",
        stdout: (line) => output.push(line), stderr: (line) => errors.push(line),
        runtimeOptions: { dbPath: join(state, "zeko.db"), worktreeRoot: join(state, "wt"), adapters: { "claude-code": claude, codex } },
      });
      expect(exitCode, `${errors.join("\n")}\n${output.join("\n")}`).toBe(0);
      const events = output.map((line) => JSON.parse(line) as Record<string, unknown>);
      const finished = events.find((event) => event["type"] === "run.finished") as { totals: { partial: boolean }; nodes: Array<{ nodeId: string; status: string; cost?: unknown }> };
      expect(finished.totals.partial).toBe(true);
      expect(finished.nodes.find((node) => node.nodeId === "codex")?.status, JSON.stringify(finished.nodes)).toBe("completed");
      expect(finished.nodes.find((node) => node.nodeId === "codex")?.cost).toBeUndefined();
      expect(events.some((event) => JSON.stringify(event).includes("policy denial")), JSON.stringify(events)).toBe(true);
      const runFinished = JSON.parse(output.at(-1) ?? "{}") as { runId: string };
      const detailOutput: string[] = [];
      expect(await runsShowCommand({ runId: runFinished.runId, json: true, stdout: (line) => detailOutput.push(line), runtimeOptions: { dbPath: join(state, "zeko.db"), worktreeRoot: join(state, "wt") } })).toBe(0);
      const detail = JSON.parse(detailOutput[0] ?? "{}") as { nodeRuns: Array<{ nodeId: string; baseCommit?: string; resultCommit?: string; inferredDenials?: unknown[]; cost?: unknown }> };
      const claudeNode = detail.nodeRuns.find((node) => node.nodeId === "claude");
      const codexNode = detail.nodeRuns.find((node) => node.nodeId === "codex");
      expect(claudeNode?.resultCommit).toBeTruthy();
      expect(codexNode?.baseCommit).toBe(claudeNode?.resultCommit);
      expect(codexNode?.inferredDenials?.length).toBeGreaterThan(0);
      expect(codexNode?.cost).toBeUndefined();
      expect(await git(root, "rev-parse", "HEAD")).toBe(originalHead);
      expect(await git(root, "status", "--porcelain")).toBe(originalStatus);
      expect(await readFile(join(root, "seed.txt"), "utf8")).toBe("original\n");
      expect(runFinished.runId).toBeTruthy();
    } finally { await claude.dispose(); await codex.dispose(); await rm(root, { recursive: true, force: true }); await rm(state, { recursive: true, force: true }); }
  }, 60_000);

  it("retries an exit-zero process-create failure without consuming maxRetries", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-codex-retry-"));
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    await mkdir(localData, { recursive: true });
    const state = join(localData, `zeko-codex-retry-${process.pid}-${Date.now()}`);
    await mkdir(state, { recursive: true });
    const firstScenario = join(state, "first.json");
    const secondScenario = join(state, "second.json");
    const firstAdapter = new CodexAdapter({ binaryPath: process.execPath, prefixArgs: ["--experimental-strip-types", fakeAgent, firstScenario], versionArgs: ["-e", "process.stdout.write('Codex CLI 0.4.12')"], authArgs: ["-e", "process.exit(0)"], codexHome: join(state, "empty-home") });
    const secondAdapter = new CodexAdapter({ binaryPath: process.execPath, prefixArgs: ["--experimental-strip-types", fakeAgent, secondScenario], versionArgs: ["-e", "process.stdout.write('Codex CLI 0.4.12')"], authArgs: ["-e", "process.exit(0)"], codexHome: join(state, "empty-home") });
    let launches = 0;
    const codex = {
      id: "codex" as const,
      capabilities: (platform: "win32" | "linux") => firstAdapter.capabilities(platform),
      detect: () => firstAdapter.detect(),
      readUsage: () => firstAdapter.readUsage(),
      launch: (spec: Parameters<CodexAdapter["launch"]>[0]) => (launches++ === 0 ? firstAdapter : secondAdapter).launch(spec),
      requestReport: (execution: Parameters<CodexAdapter["requestReport"]>[0], spec: Parameters<CodexAdapter["requestReport"]>[1]) => secondAdapter.requestReport(execution, spec),
    };
    try {
      await git(root, "init", "--quiet"); await git(root, "config", "user.name", "Codex retry test"); await git(root, "config", "user.email", "codex-retry.invalid");
      await writeFile(join(root, "seed.txt"), "read only\n", "utf8"); await git(root, "add", "."); await git(root, "commit", "--quiet", "-m", "base");
      await mkdir(join(root, ".zeko", "flows"), { recursive: true });
      await writeFile(firstScenario, JSON.stringify({ mode: "replay", fixture: "codex/events/turn.completed.json", stderrLines: ["CreateProcessWithLogonW failed: 267"], exitCode: 0 }));
      await writeFile(secondScenario, JSON.stringify({ mode: "replay", fixture: "codex/events/e2e-report.jsonl", exitCode: 0 }));
      await writeFile(join(root, ".zeko", "flows", "retry.flow.yaml"), retryFlowYaml());
      const output: string[] = [];
      const errors: string[] = [];
      const exitCode = await runCommand({ flow: "retry", project: root, json: true, stdout: (line) => output.push(line), stderr: (line) => errors.push(line), runtimeOptions: { dbPath: join(state, "zeko.db"), worktreeRoot: join(state, "worktrees"), adapters: { codex } } });
      expect(exitCode, `${errors.join("\n")}\n${output.join("\n")}`).toBe(0);
      expect(launches).toBe(2);
      const final = JSON.parse(output.at(-1) ?? "{}") as { runId: string; nodes: Array<{ nodeId: string; status: string }> };
      expect(final.nodes.find((node) => node.nodeId === "codex")?.status).toBe("completed");
      const details: string[] = [];
      expect(await runsShowCommand({ runId: final.runId, json: true, stdout: (line) => details.push(line), runtimeOptions: { dbPath: join(state, "zeko.db"), worktreeRoot: join(state, "worktrees") } })).toBe(0);
      const shown = JSON.parse(details[0] ?? "{}") as { nodeRuns: Array<{ nodeId: string; attempts: Array<{ kind: string; processOutcome?: { kind: string; cause?: string } }> }> };
      expect(shown.nodeRuns.find((node) => node.nodeId === "codex")?.attempts.map((attempt) => [attempt.kind, attempt.processOutcome?.kind, attempt.processOutcome?.cause])).toEqual([
        ["agent", "infra_failure", "process_create"], ["infra_retry", "exited", undefined],
      ]);
    } finally { await firstAdapter.dispose(); await secondAdapter.dispose(); await rm(root, { recursive: true, force: true }); await rm(state, { recursive: true, force: true }); }
  }, 60_000);
});

function flowYaml(): string {
  return `schemaVersion: 1
id: mixed
name: Mixed
nodes:
  - id: goal
    type: input
    position: { x: 0, y: 0 }
    objective: Verify a mixed provider flow
  - id: claude
    type: agent
    position: { x: 1, y: 0 }
    agent: claude-code
    models:
      claude-code: { model: claude-sonnet-5 }
    instructions: Read only
    acceptanceCriteria: []
    writeScope: ['**']
    terminal: { enabled: false, allowedCommands: [] }
    limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 }
  - id: approve
    type: approval
    position: { x: 2, y: 0 }
  - id: codex
    type: agent
    position: { x: 3, y: 0 }
    agent: codex
    models:
      codex: { model: gpt-5.4-mini, reasoningEffort: low }
    instructions: Read only
    acceptanceCriteria: []
    writeScope: []
    terminal: { enabled: false, allowedCommands: [] }
    limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 }
edges:
  - { from: goal, to: claude }
  - { from: claude, to: approve }
  - { from: approve, to: codex }
`;
}
async function git(root: string, ...args: string[]): Promise<string> { return (await execFile("git", args, { cwd: root })).stdout.trim(); }

function retryFlowYaml(): string {
  return `schemaVersion: 1
id: retry
name: Retry
nodes:
  - id: goal
    type: input
    position: { x: 0, y: 0 }
    objective: Read the seed without making changes.
  - id: codex
    type: agent
    position: { x: 1, y: 0 }
    agent: codex
    models:
      codex: { model: gpt-6-sol, reasoningEffort: low }
    instructions: Read seed.txt. Do not write files.
    acceptanceCriteria: []
    writeScope: ['**']
    terminal: { enabled: false, allowedCommands: [] }
    limits: { timeoutMinutes: 2, maxTurns: 3, maxRetries: 0 }
edges:
  - { from: goal, to: codex }
`;
}
