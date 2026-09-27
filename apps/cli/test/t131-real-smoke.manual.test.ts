import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { describe, expect, it } from "vitest";
import { toAgentReportJsonSchema } from "../../../packages/contracts/src/agent-report.ts";
import type { AgentExecution } from "../../../packages/contracts/src/adapter/adapter.ts";
import type { LaunchSpec } from "../../../packages/contracts/src/adapter/launch-spec.ts";
import { CodexAdapter } from "../../../packages/adapters/src/codex/adapter.ts";
import { resolveCodexBinary } from "../../../packages/adapters/src/codex/binary.ts";
import { CodexRolloutReader } from "../../../packages/adapters/src/codex/rollout.ts";
import { runCommand } from "../src/commands/run.js";
import { runsShowCommand } from "../src/commands/runs.js";

const execFile = promisify(execFileCallback);
const enabled = process.env["ZEKO_RUN_T131"] === "1";
const reportSchema = toAgentReportJsonSchema();

describe("T131 real Codex smoke (manual; explicit enablement required)", () => {
  it.skipIf(!enabled)("runs a read-only real Codex CLI node", async () => {
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    await mkdir(localData, { recursive: true });
    const state = await mkdtemp(join(localData, "zeko-t131-codex-"));
    const repo = join(state, "repo");
    const dbPath = join(state, "zeko.db");
    const worktreeRoot = join(state, "worktrees");
    try {
      await mkdir(repo, { recursive: true });
      await git(repo, "init", "--quiet");
      await git(repo, "config", "user.name", "Codex smoke");
      await git(repo, "config", "user.email", "codex-smoke.invalid");
      await writeFile(join(repo, "readme.txt"), "Smoke fixture: report the number of words in this file.\n", "utf8");
      await mkdir(join(repo, ".zeko", "flows"), { recursive: true });
      await writeFile(join(repo, ".zeko", "flows", "codex-smoke.flow.yaml"), flowYaml());
      await git(repo, "add", ".");
      await git(repo, "commit", "--quiet", "-m", "Codex smoke fixture");
      const headBefore = await git(repo, "rev-parse", "HEAD");
      const statusBefore = await git(repo, "status", "--porcelain");
      const output: string[] = [];
      const errors: string[] = [];
      expect(await runRealCli({ flow: "codex-smoke", project: repo, json: true, stdout: (line) => output.push(line), stderr: (line) => errors.push(line), runtimeOptions: { dbPath, worktreeRoot } }), `${errors.join("\n")}\n${output.join("\n")}`).toBe(0);
      const finished = output.map((line) => JSON.parse(line) as Record<string, unknown>).find((item) => item["type"] === "run.finished") as { runId: string; totals: { partial: boolean }; nodes: Array<{ nodeId: string; status: string; cost?: unknown }> };
      expect(finished.nodes.find((node) => node.nodeId === "codex")).toMatchObject({ status: "completed" });
      expect(finished.nodes.find((node) => node.nodeId === "codex")?.cost).toBeUndefined();
      expect(finished.totals.partial).toBe(true);

      const details: string[] = [];
      expect(await runsShowCommand({ runId: finished.runId, json: true, stdout: (line) => details.push(line), runtimeOptions: { dbPath, worktreeRoot } })).toBe(0);
      const detail = JSON.parse(details[0] ?? "{}") as { nodeRuns: Array<{ nodeId: string; report?: unknown; model?: unknown; workspacePath?: string; attempts?: Array<{ processOutcome?: { sessionId?: string } }> }> };
      const node = detail.nodeRuns.find((item) => item.nodeId === "codex");
      expect(node?.report).toMatchObject({ status: "COMPLETED" });
      expect(node?.model).toMatchObject({ model: "gpt-6-sol", reasoningEffort: "low" });
      const threadId = node?.attempts?.[0]?.processOutcome?.sessionId;
      expect(threadId).toBeTruthy();
      const worktrees = (await execFile("git", ["worktree", "list", "--porcelain"], { cwd: repo })).stdout.split(/\r?\n/u).filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length));
      const workspacePath = worktrees.find((path) => resolve(path).toLowerCase() !== resolve(repo).toLowerCase());
      expect(workspacePath).toBeTruthy();
      expect(await readFile(join(workspacePath, "readme.txt"), "utf8")).toContain("Smoke fixture");
      const codexHome = join(homedir(), ".codex");
      const rollout = await new CodexRolloutReader({ codexHome }).read(threadId);
      expect(rollout).toMatchObject({ model: "gpt-6-sol", effort: "low" });
      const historyPath = await findRollout(join(codexHome, "sessions"), threadId!);
      const history = await readFile(historyPath, "utf8");
      expect(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(history)).toBe(false);
      expect(await git(repo, "rev-parse", "HEAD")).toBe(headBefore);
      expect(await git(repo, "status", "--porcelain")).toBe(statusBefore);
      expect(await readFile(join(repo, "readme.txt"), "utf8")).toContain("Smoke fixture");

      const fork = await probeFork(workspacePath!, threadId!);
      expect(fork.outcome.kind).toBe("exited");
      expect(fork.report.state).toBe("valid");
      expect(await git(repo, "rev-parse", "HEAD")).toBe(headBefore);
      expect(await git(repo, "status", "--porcelain")).toBe(statusBefore);

      const evidenceDirectory = join(localData, "Zeko", "evidence");
      await mkdir(evidenceDirectory, { recursive: true });
      const evidence = [
        "# T131 Codex real smoke", "",
        `- CLI: ${await nativeCodexVersion()}; auth status successful (no account data recorded).`,
        "- Read-only CLI node completed with a schema-valid report; Codex node cost absent; aggregate marked partial.",
        `- Rollout model=${rollout.model}, effort=${rollout.effort}; email-pattern scan clean.`,
        "- Original repo HEAD and working-tree status unchanged.",
        "- U-14 fork: accepted --json, --output-schema, --ignore-user-config, and --ignore-rules; strict report validated.",
        `- Thread ID: ${threadId}`,
      ].join("\n");
      await writeFile(join(evidenceDirectory, `t131-codex-smoke-${new Date().toISOString().replaceAll(":", "-")}.md`), `${evidence}\n`, { encoding: "utf8", flag: "wx" });
    } finally { await rm(state, { recursive: true, force: true }); }
  }, 300_000);
});

async function probeFork(workspacePath: string, threadId: string) {
  const spec: LaunchSpec = {
    agentId: "codex", runId: "018f0000-0000-7000-8000-000000000121", nodeRunId: "018f0000-0000-7000-8000-000000000122", attemptId: "018f0000-0000-7000-8000-000000000123",
    workspacePath, model: { model: "gpt-6-sol", reasoningEffort: "low" },
    prompt: "Read readme.txt. Return a valid report only; do not modify any files.", reportSchema,
    writeScope: [], terminal: { enabled: false, allowedCommands: [] }, platform: process.platform === "win32" ? "win32" : "linux",
  };
  const previous = { events: [] as never[], completion: Promise.resolve({ outcome: { kind: "exited", exitCode: 0, durationMs: 1, sessionId: threadId }, report: { state: "absent" } }), rootPid: { pid: 0, creationTime: 0 }, sensitiveValues: [], cancel: async () => undefined } as unknown as AgentExecution;
  const testEnv = process.env["ZEKO_TEST"];
  delete process.env["ZEKO_TEST"];
  const adapter = new CodexAdapter({ forkReport: true });
  try {
    const execution = adapter.requestReport(previous, spec);
    const eventTypes: string[] = [];
    for await (const event of execution.events) eventTypes.push(event.type);
    expect(eventTypes).toContain("session_started");
    return await execution.completion;
  } finally { await adapter.dispose(); if (testEnv !== undefined) process.env["ZEKO_TEST"] = testEnv; }
}

async function findRollout(root: string, threadId: string): Promise<string> {
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) { const found = await findRollout(path, threadId).catch(() => undefined); if (found) return found; }
    else if (entry.name.includes(threadId) && entry.name.endsWith(".jsonl")) return path;
  }
  throw new Error("Codex rollout file was not found");
}
async function git(cwd: string, ...args: string[]): Promise<string> { return (await execFile("git", args, { cwd })).stdout.trim(); }
async function runRealCli(options: Parameters<typeof runCommand>[0]): Promise<number> {
  const testEnv = process.env["ZEKO_TEST"];
  delete process.env["ZEKO_TEST"];
  try { return await runCommand(options); }
  finally { if (testEnv !== undefined) process.env["ZEKO_TEST"] = testEnv; }
}
async function nativeCodexVersion(): Promise<string> {
  const testEnv = process.env["ZEKO_TEST"];
  delete process.env["ZEKO_TEST"];
  try { return (await execFile(resolveCodexBinary(), ["--version"])).stdout.trim(); }
  finally { if (testEnv !== undefined) process.env["ZEKO_TEST"] = testEnv; }
}
function flowYaml(): string {
  return `schemaVersion: 1
id: codex-smoke
name: Codex smoke
nodes:
  - id: goal
    type: input
    position: { x: 0, y: 0 }
    objective: Read readme.txt and report the number of words. Do not modify any files.
  - id: codex
    type: agent
    position: { x: 1, y: 0 }
    agent: codex
    models:
      codex: { model: gpt-6-sol, reasoningEffort: low }
    instructions: Read readme.txt and return a valid structured report. Do not write files.
    acceptanceCriteria: []
    writeScope: []
    terminal: { enabled: false, allowedCommands: [] }
    limits: { timeoutMinutes: 4, maxTurns: 3, maxRetries: 0 }
edges:
  - { from: goal, to: codex }
`;
}
