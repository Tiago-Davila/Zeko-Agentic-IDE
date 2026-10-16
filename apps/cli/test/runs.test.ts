import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CLAUDE_LIKE_CAPABILITIES } from "../../../packages/testing/src/capability-profiles.js";
import { ScriptedAdapter } from "../../../packages/testing/src/scripted-adapter.js";
import { runCommand } from "../src/commands/run.js";
import { runsListCommand, runsShowCommand } from "../src/commands/runs.js";

const execFile = promisify(execFileCallback);
async function initRepo(root: string) {
  await execFile("git", ["init", "--quiet"], { cwd: root });
  await execFile("git", ["config", "user.name", "Test"], { cwd: root });
  await execFile("git", ["config", "user.email", "test@example.invalid"], { cwd: root });
  await writeFile(join(root, "seed.txt"), "seed\n"); await execFile("git", ["add", "."], { cwd: root });
  await execFile("git", ["commit", "--quiet", "-m", "seed"], { cwd: root });
}

describe("zeko runs list/show", () => {
  it("reads persisted run details and registered process identities", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-runs-"));
    const dbPath = join(root, "zeko.db");
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    const worktreeRoot = join(localData, `zeko-runs-test-${process.pid}-${Date.now()}`);
    try {
      await initRepo(root); await mkdir(join(root, ".zeko/flows"), { recursive: true });
      await writeFile(join(root, ".zeko/flows/goal.flow.yaml"), "schemaVersion: 1\nid: goal\nname: Goal\nnodes:\n  - id: goal\n    type: input\n    position: { x: 0, y: 0 }\n    objective: Goal\n  - id: a\n    type: agent\n    position: { x: 1, y: 0 }\n    agent: claude-code\n    models:\n      claude-code: { model: test }\n    instructions: Implement\n    acceptanceCriteria: []\n    writeScope: []\n    terminal: { enabled: false, allowedCommands: [] }\n    limits: { timeoutMinutes: 1, maxTurns: 1, maxRetries: 0 }\nedges:\n  - { from: goal, to: a }\n");
      const adapter = new ScriptedAdapter({ id: "claude-code", capabilities: CLAUDE_LIKE_CAPABILITIES, executions: [{ rootPid: { pid: 43210, creationTime: 777 }, report: { state: "valid", report: { status: "COMPLETED", summary: "Done", filesChanged: [], checks: [], blockers: [], findings: [] } } }] });
      const runOutput: string[] = []; const errors: string[] = [];
      const code = await runCommand({
        flow: "goal", project: root, json: true, stdout: (line) => runOutput.push(line), stderr: (line) => errors.push(line),
        runtimeOptions: { dbPath, worktreeRoot, adapters: { "claude-code": adapter } },
      });
      expect(code, JSON.stringify({ errors, runOutput })).toBe(0);
      const finished = JSON.parse(runOutput.at(-1) ?? "{}") as { runId: string };
      const listed: string[] = [];
      expect(await runsListCommand({ project: root, json: true, stdout: (line) => listed.push(line), runtimeOptions: { dbPath, worktreeRoot } })).toBe(0);
      expect(JSON.parse(listed[0] ?? "{}").runs).toHaveLength(1);
      const shown: string[] = [];
      expect(await runsShowCommand({ runId: finished.runId, json: true, stdout: (line) => shown.push(line), runtimeOptions: { dbPath, worktreeRoot } })).toBe(0);
      expect(JSON.parse(shown[0] ?? "{}").nodeRuns).toContainEqual(expect.objectContaining({ nodeId: "a", status: "completed" }));
      expect(JSON.parse(shown[0] ?? "{}").processes).toContainEqual(expect.objectContaining({ pid: 43210, creationTime: 777, isRoot: true }));
    } finally { await rm(worktreeRoot, { recursive: true, force: true }); await rm(root, { recursive: true, force: true }); }
  });
});
