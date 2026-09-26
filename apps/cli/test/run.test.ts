import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/commands/run.js";

const execFile = promisify(execFileCallback);
async function initRepo(root: string) {
  await execFile("git", ["init", "--quiet"], { cwd: root });
  await execFile("git", ["config", "user.name", "Test"], { cwd: root });
  await execFile("git", ["config", "user.email", "test@example.invalid"], { cwd: root });
  await writeFile(join(root, "seed.txt"), "seed\n");
  await execFile("git", ["add", "."], { cwd: root });
  await execFile("git", ["commit", "--quiet", "-m", "seed"], { cwd: root });
}

describe("zeko run", () => {
  it("runs a validated input-only flow through shared runtime and emits NDJSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-cli-run-"));
    try {
      await initRepo(root); await mkdir(join(root, ".zeko/flows"), { recursive: true });
      await writeFile(join(root, ".zeko/flows/goal.flow.yaml"), "schemaVersion: 1\nid: goal\nname: Goal\nnodes:\n  - id: goal\n    type: input\n    position: { x: 0, y: 0 }\n    objective: Verify runtime\nedges: []\n");
      const lines: string[] = [];
      const code = await runCommand({ flow: "goal", project: root, json: true, stdout: (line) => lines.push(line), runtimeOptions: { dbPath: join(root, "zeko.db"), worktreeRoot: join(root, "wt") } });
      expect(code).toBe(0);
      const events = lines.map((line) => JSON.parse(line) as { type: string });
      expect(events.map((event) => event.type)).toContain("run.started");
      expect(events.at(-1)?.type).toBe("run.finished");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("refuses approval-bearing flows before creating a run when stdin is not a TTY", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-cli-run-"));
    try {
      await initRepo(root); await mkdir(join(root, ".zeko/flows"), { recursive: true });
      await writeFile(join(root, ".zeko/flows/approval.flow.yaml"), "schemaVersion: 1\nid: approval\nname: Approval\nnodes:\n  - id: goal\n    type: input\n    position: { x: 0, y: 0 }\n    objective: Goal\n  - id: review\n    type: approval\n    position: { x: 1, y: 0 }\nedges:\n  - { from: goal, to: review }\n");
      const stderr: string[] = [];
      const code = await runCommand({ flow: "approval", project: root, stdinIsTTY: false, stderr: (line) => stderr.push(line), runtimeOptions: { dbPath: join(root, "zeko.db"), worktreeRoot: join(root, "wt") } });
      expect(code).toBe(3); expect(stderr.join(" ")).toContain("APPROVAL_REQUIRES_TTY");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
