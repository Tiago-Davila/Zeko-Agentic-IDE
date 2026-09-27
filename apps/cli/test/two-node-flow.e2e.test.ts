import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { describe, expect, it } from "vitest";
import { FakeAdapter } from "../../../packages/adapters/src/fake/fake-adapter.js";
import { runCommand } from "../src/commands/run.js";
import { runsShowCommand } from "../src/commands/runs.js";

const execFile = promisify(execFileCallback);
async function git(root: string, ...args: string[]) { return (await execFile("git", args, { cwd: root })).stdout.trim(); }

describe("CLI two-node flow end-to-end", () => {
  it("runs goal → a → b in isolated fake-agent processes and leaves the source repo intact", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-cli-e2e-"));
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    const stateRoot = join(localData, `zeko-cli-e2e-${process.pid}-${Date.now()}`);
    const worktreeRoot = join(stateRoot, "wt");
    const dbPath = join(stateRoot, "zeko.db");
    const scenarioPath = join(root, "fake-scenario.json");
    const fake = new FakeAdapter({ scenarioPath });
    try {
      await git(root, "init", "--quiet"); await git(root, "config", "user.name", "E2E"); await git(root, "config", "user.email", "e2e@example.invalid");
      await writeFile(join(root, "seed.txt"), "original\n", "utf8"); await git(root, "add", "."); await git(root, "commit", "--quiet", "-m", "base");
      const originalHead = await git(root, "rev-parse", "HEAD");
      await writeFile(scenarioPath, JSON.stringify({ mode: "native", files: [{ path: "artifact.txt", content: "created by fake agent\n" }], outcome: { kind: "exited", exitCode: 0, durationMs: 10 }, reportCandidate: { state: "valid", report: { status: "COMPLETED", summary: "Created artifact", filesChanged: ["artifact.txt"], checks: [], blockers: [], findings: [] } } }), "utf8");
      await mkdir(join(root, ".zeko/flows"), { recursive: true });
      await writeFile(join(root, ".zeko/flows/chain.flow.yaml"), "schemaVersion: 1\nid: chain\nname: Chain\nnodes:\n  - id: goal\n    type: input\n    position: { x: 0, y: 0 }\n    objective: Build the chain\n  - id: a\n    type: agent\n    position: { x: 1, y: 0 }\n    agent: claude-code\n    models:\n      claude-code: { model: fake-test }\n    instructions: First node\n    acceptanceCriteria: []\n    writeScope: []\n    terminal: { enabled: false, allowedCommands: [] }\n    limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 }\n  - id: b\n    type: agent\n    position: { x: 2, y: 0 }\n    agent: claude-code\n    models:\n      claude-code: { model: fake-test }\n    instructions: Second node\n    acceptanceCriteria: []\n    writeScope: []\n    terminal: { enabled: false, allowedCommands: [] }\n    limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 }\nedges:\n  - { from: goal, to: a }\n  - { from: a, to: b }\n", "utf8");
      const flowPath = join(root, ".zeko/flows/chain.flow.yaml");
      await writeFile(flowPath, (await readFile(flowPath, "utf8")).replaceAll("writeScope: []", "writeScope: [artifact.txt]"), "utf8");
      const statusBeforeRun = await git(root, "status", "--porcelain");
      const adapter = {
        id: "claude-code" as const,
        capabilities: (platform: "win32" | "linux") => fake.capabilities(platform),
        detect: async () => ({ ...(await fake.detect()), agentId: "claude-code" as const }),
        readUsage: () => fake.readUsage(),
        launch: (spec: Parameters<FakeAdapter["launch"]>[0]) => fake.launch({ ...spec, agentId: "fake" }),
        requestReport: (execution: Parameters<FakeAdapter["requestReport"]>[0], spec: Parameters<FakeAdapter["requestReport"]>[1]) => fake.requestReport(execution, { ...spec, agentId: "fake" }),
      };
      const output: string[] = []; const errors: string[] = [];
      const exitCode = await runCommand({ flow: "chain", project: root, json: true, stdout: (line) => output.push(line), stderr: (line) => errors.push(line), runtimeOptions: { dbPath, worktreeRoot, adapters: { "claude-code": adapter } } });
      expect(exitCode, errors.join("\n")).toBe(0);
      const finished = JSON.parse(output.at(-1) ?? "{}") as { runId: string; nodes: Array<{ nodeId: string; status: string }> };
      expect(finished.nodes.map((node) => [node.nodeId, node.status])).toEqual([["goal", "completed"], ["a", "completed"], ["b", "completed"]]);

      const detailLines: string[] = [];
      expect(await runsShowCommand({ runId: finished.runId, json: true, stdout: (line) => detailLines.push(line), runtimeOptions: { dbPath, worktreeRoot } })).toBe(0);
      const detail = JSON.parse(detailLines[0] ?? "{}") as { run: { id: string }; nodeRuns: Array<{ nodeId: string; baseCommit?: string; resultCommit?: string }> };
      const a = detail.nodeRuns.find((node) => node.nodeId === "a"); const b = detail.nodeRuns.find((node) => node.nodeId === "b");
      expect(a?.resultCommit).toBeTruthy(); expect(b?.baseCommit).toBe(a?.resultCommit);
      expect(detail.run.id).toBe(finished.runId);
      expect(await git(root, "rev-parse", "HEAD")).toBe(originalHead);
      expect(await git(root, "status", "--porcelain")).toBe(statusBeforeRun);
      expect(await readFile(join(root, "seed.txt"), "utf8")).toBe("original\n");
    } finally { await fake.dispose(); await rm(stateRoot, { recursive: true, force: true }); await rm(root, { recursive: true, force: true }); }
  }, 30_000);
});
