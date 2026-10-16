import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp as mkdtempAsync, rm as rmAsync, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, FlowFile, LaunchSpec, Platform, WorkspacePort } from "@zeko/contracts";
import { ProjectConfigSchema } from "@zeko/contracts";
import { RunEngine } from "@zeko/core";
import { cleanupRunWorktrees, GitWorkspacePort, runGit } from "@zeko/git";
import { CLAUDE_LIKE_CAPABILITIES } from "@zeko/testing";
import {
  ControllableClock,
  InMemoryRunStore,
  InMemorySlotLeasePort,
  ScriptedAdapter,
} from "@zeko/testing";
import { describe, expect, it } from "vitest";

const report = {
  status: "COMPLETED" as const,
  summary: "done",
  filesChanged: [] as string[],
  checks: [],
  blockers: [] as string[],
  findings: [] as string[],
};

function agent(id: string) {
  return {
    id,
    type: "agent" as const,
    position: { x: 0, y: 0 },
    agent: "claude-code" as const,
    models: { "claude-code": { model: "test-model" } },
    instructions: `Implement ${id}`,
    acceptanceCriteria: [],
    writeScope: ["**"],
    terminal: { enabled: false, allowedCommands: [] },
    limits: { timeoutMinutes: 5, maxTurns: 10, maxRetries: 0 },
  };
}

async function snapshot(
  repo: string,
): Promise<{ treeHash: string; head: string; branch: string; status: string }> {
  const [tree, head, branch, status] = await Promise.all([
    runGit("ls-tree", ["-r", "-z", "HEAD"], { cwd: repo }),
    runGit("rev-parse", ["HEAD"], { cwd: repo }),
    runGit("branch", ["--show-current"], { cwd: repo }),
    runGit("status", ["--porcelain"], { cwd: repo }),
  ]);
  return {
    treeHash: createHash("sha256").update(tree.stdout).digest("hex"),
    head: head.stdout.trim(),
    branch: branch.stdout.trim(),
    status: status.stdout,
  };
}

describe("Windows repository isolation", () => {
  it.skipIf(process.platform !== "win32")(
    "leaves the original tree, HEAD, branch, and status unchanged across multiple agent nodes",
    async () => {
      const parent = await mkdtempAsync(join(tmpdir(), "zeko-isolation-win-"));
      const repo = join(parent, "repo");
      const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), "AppData", "Local");
      const worktreeRoot = join(localData, "Zeko", "wt");
      mkdirSync(repo);
      await runGit("init", ["--quiet"], { cwd: repo });
      await runGit("config", ["user.name", "Test User"], { cwd: repo });
      await runGit("config", ["user.email", "test@example.invalid"], { cwd: repo });
      await writeFile(join(repo, "base.txt"), "base\n");
      await runGit("add", ["."], { cwd: repo });
      await runGit("commit", ["--quiet", "-m", "base"], { cwd: repo });
      const before = await snapshot(repo);
      const runId = "018f0000-0000-7000-8000-000000000001";
      const nodes = [agent("first"), agent("second"), agent("third")];
      const flow: FlowFile = {
        schemaVersion: 1,
        id: "isolation-flow",
        name: "Isolation flow",
        nodes: [
          {
            id: "goal",
            type: "input",
            position: { x: 0, y: 0 },
            objective: "Keep changes isolated",
          },
          ...nodes,
        ],
        edges: [
          { from: "goal", to: "first" },
          { from: "first", to: "second" },
          { from: "second", to: "third" },
        ],
      };
      const executions = nodes.map(() => ({ report: { state: "valid" as const, report } }));
      const scripted = new ScriptedAdapter({
        id: "claude-code",
        capabilities: CLAUDE_LIKE_CAPABILITIES,
        executions,
      });
      let launchIndex = 0;
      const adapter: AgentAdapter = {
        id: scripted.id,
        capabilities: (platform: Platform) => scripted.capabilities(platform),
        detect: () => scripted.detect(),
        readUsage: () => scripted.readUsage(),
        launch(spec: LaunchSpec) {
          const node = nodes[launchIndex++];
          if (node) writeFileSync(join(spec.workspacePath, `${node.id}.txt`), `${node.id}\n`);
          return scripted.launch(spec);
        },
        requestReport: (previous, spec) => scripted.requestReport(previous, spec),
      };
      const gitWorkspace = new GitWorkspacePort(repo, worktreeRoot);
      const workspaces: Array<{ path: string; branch: string }> = [];
      const workspace: WorkspacePort = {
        async create(input) {
          const created = await gitWorkspace.create(input);
          workspaces.push(created);
          return created;
        },
        remove: (path) => gitWorkspace.remove(path),
        commit: (input) => gitWorkspace.commit(input),
        markUntrusted: (path) => gitWorkspace.markUntrusted(path),
      };
      const clock = new ControllableClock();
      let idSerial = 1;
      const engine = new RunEngine({
        flow,
        projectConfig: ProjectConfigSchema.parse({}),
        adapters: { "claude-code": adapter },
        workspace,
        store: new InMemoryRunStore(),
        slots: new InMemorySlotLeasePort(),
        clock,
        projectRoot: repo,
        flowFile: ".zeko/flows/isolation-flow.flow.yaml",
        flowHash: "hash",
        baseCommit: before.head,
        platform: "win32",
        hostPid: process.pid,
        hostStartedAt: clock.now(),
        enforceTimeouts: false,
        createId: () => {
          const serial = idSerial++;
          return serial === 1
            ? runId
            : `018f0000-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`;
        },
      });
      try {
        const result = await engine.execute();
        expect(result.run.status).toBe("finished");
        expect(await snapshot(repo)).toEqual(before);
      } finally {
        await cleanupRunWorktrees({
          repoPath: repo,
          worktreeRoot,
          runId,
          workspaces,
          confirmed: true,
        });
        await rmAsync(join(worktreeRoot, runId.replaceAll("-", "").slice(0, 8)), {
          recursive: true,
          force: true,
        });
        await rmAsync(parent, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
