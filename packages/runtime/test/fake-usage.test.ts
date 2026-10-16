import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { FlowFile } from "@zeko/contracts";
import { CLAUDE_LIKE_CAPABILITIES, CODEX_LIKE_CAPABILITIES, ScriptedAdapter } from "@zeko/testing";
import { createZekoRuntime } from "../src/create-runtime.js";

const execFile = promisify(execFileCallback);
async function git(root: string, ...args: string[]) { return (await execFile("git", args, { cwd: root })).stdout.trim(); }

describe("development fake usage", () => {
  it("holds Claude nodes at the simulated threshold and keeps the run cancellable", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-fake-usage-"));
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    const stateRoot = join(localData, `zeko-fake-usage-${process.pid}-${Date.now()}`);
    const claude = new ScriptedAdapter({ id: "claude-code", capabilities: CLAUDE_LIKE_CAPABILITIES });
    const codex = new ScriptedAdapter({
      id: "codex", capabilities: CODEX_LIKE_CAPABILITIES,
      executions: [{ outcome: { kind: "exited", exitCode: 0, durationMs: 1 }, report: {
        state: "valid", report: { status: "COMPLETED", summary: "Codex work completed.", filesChanged: [], checks: [], blockers: [], findings: [] },
      } }],
    });
    let runtime: Awaited<ReturnType<typeof createZekoRuntime>> | undefined;
    try {
      await git(root, "init", "--quiet");
      await git(root, "config", "user.name", "Test");
      await git(root, "config", "user.email", "test@example.invalid");
      await writeFile(join(root, "seed.txt"), "base\n");
      await git(root, "add", ".");
      await git(root, "commit", "--quiet", "-m", "base");

      runtime = await createZekoRuntime({
        dbPath: join(stateRoot, "zeko.db"), worktreeRoot: join(stateRoot, "wt"),
        adapters: { "claude-code": claude, codex }, development: true, fakeUsage: 0.95,
      });
      const project = await runtime.openProject(root);
      const { flowId } = await runtime.createFlow(project.projectId, "held-usage");
      const loaded = await runtime.loadFlow(project.projectId, flowId);
      const flow: FlowFile = {
        schemaVersion: 1, id: flowId, name: "Held usage",
        nodes: [
          { id: "goal", type: "input", position: { x: 0, y: 0 }, objective: "Wait for usage" },
          {
            id: "agent", type: "agent", position: { x: 1, y: 0 }, agent: "claude-code",
            models: { "claude-code": { model: "sonnet" } }, instructions: "Do not launch while usage is high.",
            acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: false, allowedCommands: [] },
            limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 },
          },
          {
            id: "review", type: "agent", position: { x: 2, y: 0 }, agent: "codex",
            models: { codex: { model: "gpt-6-luna", reasoningEffort: "low" } }, instructions: "Complete the independent review.",
            acceptanceCriteria: [], writeScope: ["**"], terminal: { enabled: true, allowedCommands: [] },
            limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 },
          },
        ], edges: [{ from: "goal", to: "agent" }, { from: "goal", to: "review" }],
      };
      await runtime.saveFlow(project.projectId, flow, loaded.fileHash);

      let resolveHeld!: (runId: string) => void;
      const held = new Promise<string>((resolve) => { resolveHeld = resolve; });
      const unsubscribe = runtime.subscribe((event) => {
        if (event.type === "run.held" && event.runId) resolveHeld(event.runId);
      });
      const saved = await runtime.loadFlow(project.projectId, flowId);
      const started = await runtime.startRun(project.projectId, flowId, saved.fileHash, "desktop");
      await expect(held).resolves.toBe(started.runId);
      const detail = await runtime.getRun(started.runId);
      const nodeRuns = detail?.nodeRuns as Array<{ nodeId: string; status: string; hold?: string }> | undefined;
      expect(nodeRuns?.find((nodeRun) => nodeRun.nodeId === "agent")).toMatchObject({ status: "pending", hold: "USAGE_NEAR_LIMIT" });
      expect(nodeRuns?.find((nodeRun) => nodeRun.nodeId === "review")?.status).toBe("completed");
      expect(claude.launches).toHaveLength(0);
      expect(codex.launches).toHaveLength(1);

      await runtime.cancelRun(started.runId);
      const finished = await started.wait;
      unsubscribe();
      expect(finished.run.status).toBe("cancelled");
    } finally {
      runtime?.close();
      await rm(stateRoot, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("does not activate the fake usage override outside development", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-fake-usage-prod-"));
    const adapter = new ScriptedAdapter({ id: "claude-code", capabilities: CLAUDE_LIKE_CAPABILITIES });
    const runtime = await createZekoRuntime({
      dbPath: join(root, "zeko.db"), worktreeRoot: join(root, "wt"),
      adapters: { "claude-code": adapter }, development: false, fakeUsage: 0.95,
    });
    try {
      const status = await runtime.agentsStatus("unused-project", ["claude-code"]);
      expect(status.usage).toEqual([]);
    } finally {
      runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
