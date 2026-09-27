import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../../packages/adapters/src/claude-code/adapter.ts";
import { runCommand } from "../src/commands/run.js";

const execFile = promisify(execFileCallback);
const fakeAgentPath = fileURLToPath(new URL("../../../packages/adapters/test/fake-agent/main.ts", import.meta.url));

describe("CLI Claude dialect end-to-end", () => {
  it("runs completed and denial/scope fixtures through the registered shared-runtime adapter", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-claude-e2e-"));
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    const state = join(localData, `zeko-claude-state-${process.pid}-${Date.now()}`);
    const scenarioPath = join(root, "fake-claude.json");
    const adapter = new ClaudeCodeAdapter({
      binaryPath: process.execPath,
      prefixArgs: ["--experimental-strip-types", fakeAgentPath, scenarioPath],
      versionArgs: ["-e", "process.stdout.write('Claude Code 2.1.280\\n')"],
    });
    try {
      await mkdir(state, { recursive: true });
      await git(root, "init", "--quiet");
      await git(root, "config", "user.name", "Claude E2E");
      await git(root, "config", "user.email", "claude-e2e@example.invalid");
      await mkdir(join(root, "src"), { recursive: true });
      await writeFile(join(root, "src/seed.txt"), "seed\n", "utf8");
      await git(root, "add", ".");
      await git(root, "commit", "--quiet", "-m", "seed");
      await mkdir(join(root, ".zeko/flows"), { recursive: true });

      for (const scenario of [
        { flow: "success", fixture: "claude/e2e-success.jsonl", files: [], exitCode: 0, expected: "completed", reason: undefined },
        { flow: "denied", fixture: "claude/e2e-denied.jsonl", files: [], exitCode: 1, expected: "blocked", reason: "ACTION_DENIED" },
        { flow: "scope", fixture: "claude/e2e-scope.jsonl", files: [{ path: "docs/outside.txt", content: "outside allowed scope\n" }], exitCode: 1, expected: "blocked", reason: "WRITE_OUTSIDE_SCOPE" },
      ]) {
        await writeFile(scenarioPath, JSON.stringify({ mode: "replay", fixture: scenario.fixture, files: scenario.files }), "utf8");
        await writeFile(join(root, `.zeko/flows/${scenario.flow}.flow.yaml`), flowYaml(scenario.flow), "utf8");
        const output: string[] = [];
        const errors: string[] = [];
        const code = await runCommand({
          flow: scenario.flow,
          project: root,
          json: true,
          stdout: (line) => output.push(line),
          stderr: (line) => errors.push(line),
          runtimeOptions: { dbPath: join(state, "zeko.db"), worktreeRoot: join(state, "wt"), adapters: { "claude-code": adapter } },
        });
        expect(code, `${errors.join("\n")}\n${output.join("\n")}`).toBe(scenario.exitCode);
        const finished = JSON.parse(output.at(-1) ?? "{}") as { nodes: Array<{ nodeId: string; status: string; reason?: { code: string } }> };
        const node = finished.nodes.find((candidate) => candidate.nodeId === "agent");
        expect(node?.status).toBe(scenario.expected);
        if (scenario.reason) expect(node?.reason?.code).toBe(scenario.reason);
      }
      expect(await readFile(join(root, "src/seed.txt"), "utf8")).toBe("seed\n");
    } finally {
      await adapter.dispose();
      await rm(root, { recursive: true, force: true });
      await rm(state, { recursive: true, force: true });
    }
  }, 45_000);
});

function flowYaml(id: string): string {
  return `schemaVersion: 1\nid: ${id}\nname: ${id}\nnodes:\n  - id: goal\n    type: input\n    position: { x: 0, y: 0 }\n    objective: Verify Claude dialect\n  - id: agent\n    type: agent\n    position: { x: 1, y: 0 }\n    agent: claude-code\n    models:\n      claude-code: { model: claude-sonnet-5 }\n    instructions: Verify replay\n    acceptanceCriteria: []\n    writeScope: ['src/**']\n    terminal: { enabled: false, allowedCommands: [] }\n    limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 }\nedges:\n  - { from: goal, to: agent }\n`;
}

async function git(root: string, ...args: string[]): Promise<string> {
  return (await execFile("git", args, { cwd: root })).stdout.trim();
}
