import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AgentAdapter,
  AgentReport,
  FlowFile,
  LaunchSpec,
  Platform,
  WorkspacePort,
} from "@zeko/contracts";
import { ProjectConfigSchema } from "@zeko/contracts";
import { RunEngine } from "@zeko/core";
import { GitWorkspacePort, runGit } from "@zeko/git";
import { CLAUDE_LIKE_CAPABILITIES } from "@zeko/testing";
import {
  ControllableClock,
  InMemoryRunStore,
  InMemorySlotLeasePort,
  ScriptedAdapter,
} from "@zeko/testing";
import { describe, expect, it } from "vitest";

const report: AgentReport = {
  status: "COMPLETED" as const,
  summary: "Changes are ready",
  filesChanged: [] as string[],
  checks: [],
  blockers: [] as string[],
  findings: [] as string[],
};

function agent(id: string, writeScope: string[]) {
  return {
    id,
    type: "agent" as const,
    position: { x: 0, y: 0 },
    agent: "claude-code" as const,
    models: { "claude-code": { model: "test-model" } },
    instructions: `Implement ${id}`,
    acceptanceCriteria: [],
    writeScope,
    terminal: { enabled: false, allowedCommands: [] },
    limits: { timeoutMinutes: 5, maxTurns: 10, maxRetries: 0 },
  };
}

function flow(nodes: FlowFile["nodes"], edges: FlowFile["edges"]): FlowFile {
  return { schemaVersion: 1, id: "workspace-flow", name: "Workspace flow", nodes, edges };
}

async function fixture(): Promise<{
  repo: string;
  worktreeRoot: string;
  baseCommit: string;
  dispose: () => Promise<void>;
}> {
  const parent = await mkdtemp(join(tmpdir(), "zeko-runtime-workspace-"));
  const repo = join(parent, "repo");
  const localData =
    process.platform === "win32" ? process.env["LOCALAPPDATA"] : process.env["XDG_DATA_HOME"];
  const worktreeRoot = join(
    localData ?? join(homedir(), ".local", "share"),
    `zeko-runtime-test-${process.pid}-${Date.now()}`,
  );
  await Promise.all([mkdir(repo), mkdir(worktreeRoot, { recursive: true })]);
  await runGit("init", ["--quiet"], { cwd: repo });
  await runGit("config", ["user.name", "Test User"], { cwd: repo });
  await runGit("config", ["user.email", "test@example.invalid"], { cwd: repo });
  await writeFile(join(repo, "base.txt"), "run base\n");
  await runGit("add", ["."], { cwd: repo });
  await runGit("commit", ["--quiet", "-m", "base"], { cwd: repo });
  const baseCommit = (await runGit("rev-parse", ["HEAD"], { cwd: repo })).stdout.trim();
  return {
    repo,
    worktreeRoot,
    baseCommit,
    dispose: async () => {
      await rm(worktreeRoot, { recursive: true, force: true });
      await rm(parent, { recursive: true, force: true });
    },
  };
}

async function execute(flowFile: FlowFile): Promise<{
  nodeRuns: Awaited<ReturnType<RunEngine["execute"]>>["nodeRuns"];
  baseCommit: string;
  created: Array<{ path: string; branch: string; nodeId: string; baseCommit: string }>;
  fixture: Awaited<ReturnType<typeof fixture>>;
}> {
  const testFixture = await fixture();
  const git = new GitWorkspacePort(testFixture.repo, testFixture.worktreeRoot);
  const created: Array<{ path: string; branch: string; nodeId: string; baseCommit: string }> = [];
  const workspace: WorkspacePort = {
    async create(input) {
      const result = await git.create(input);
      created.push({ ...result, nodeId: input.nodeId, baseCommit: input.baseCommit });
      return result;
    },
    remove: (path) => git.remove(path),
    commit: (input) => git.commit(input),
    markUntrusted: (path) => git.markUntrusted(path),
  };
  const executions = flowFile.nodes
    .filter((node) => node.type === "agent")
    .map(() => ({ report: { state: "valid" as const, report } }));
  const scripted = new ScriptedAdapter({
    id: "claude-code",
    capabilities: CLAUDE_LIKE_CAPABILITIES,
    executions,
  });
  const agentNodes = flowFile.nodes.filter((node) => node.type === "agent");
  let launchIndex = 0;
  const adapter: AgentAdapter = {
    id: scripted.id,
    capabilities: (platform: Platform) => scripted.capabilities(platform),
    detect: () => scripted.detect(),
    readUsage: () => scripted.readUsage(),
    launch(spec: LaunchSpec) {
      const node = agentNodes[launchIndex++];
      if (node?.type === "agent" && node.writeScope.length > 0) {
        writeFileSync(join(spec.workspacePath, `${node.id}.txt`), `written by ${node.id}\n`);
      }
      return scripted.launch(spec);
    },
    requestReport: (previous, spec) => scripted.requestReport(previous, spec),
  };
  let serial = 1;
  const clock = new ControllableClock();
  const engine = new RunEngine({
    flow: flowFile,
    projectConfig: ProjectConfigSchema.parse({}),
    adapters: { "claude-code": adapter },
    workspace,
    store: new InMemoryRunStore(),
    slots: new InMemorySlotLeasePort(),
    clock,
    projectRoot: testFixture.repo,
    flowFile: ".zeko/flows/workspace-flow.flow.yaml",
    flowHash: "test-hash",
    baseCommit: testFixture.baseCommit,
    platform: process.platform === "win32" ? "win32" : "linux",
    hostPid: process.pid,
    hostStartedAt: clock.now(),
    enforceTimeouts: false,
    requestApproval: async () => true,
    createId: () => `018f0000-0000-7000-8000-${(serial++).toString(16).padStart(12, "0")}`,
  });
  try {
    const result = await engine.execute();
    return {
      nodeRuns: result.nodeRuns,
      baseCommit: testFixture.baseCommit,
      created,
      fixture: testFixture,
    };
  } catch (error) {
    await testFixture.dispose();
    throw error;
  }
}

describe("GitWorkspacePort with RunEngine", () => {
  it("bases a node after approval on its code source commit", async () => {
    const result = await execute(
      flow(
        [
          { id: "goal", type: "input", position: { x: 0, y: 0 }, objective: "Build feature" },
          agent("writer-a", ["**"]),
          { id: "review", type: "approval", position: { x: 0, y: 0 } },
          agent("writer-b", ["**"]),
        ],
        [
          { from: "goal", to: "writer-a" },
          { from: "writer-a", to: "review" },
          { from: "review", to: "writer-b" },
        ],
      ),
    );
    try {
      const sourceCommit = result.nodeRuns.get("writer-a")?.resultCommit;
      expect(sourceCommit).toBeDefined();
      expect(result.nodeRuns.get("writer-b")?.baseCommit).toBe(sourceCommit);
      expect(result.created.find((item) => item.nodeId.startsWith("writer-b"))?.baseCommit).toBe(
        sourceCommit,
      );
    } finally {
      await result.fixture.dispose();
    }
  });

  it("does not pass code lineage through a read-only node", async () => {
    const result = await execute(
      flow(
        [
          { id: "goal", type: "input", position: { x: 0, y: 0 }, objective: "Build feature" },
          agent("writer", ["**"]),
          agent("reader", []),
          agent("after-reader", ["**"]),
        ],
        [
          { from: "goal", to: "writer" },
          { from: "writer", to: "reader" },
          { from: "reader", to: "after-reader" },
        ],
      ),
    );
    try {
      expect(result.nodeRuns.get("writer")?.resultCommit).toBeDefined();
      expect(result.nodeRuns.get("after-reader")?.baseCommit).toBe(result.baseCommit);
      expect(
        result.created.find((item) => item.nodeId.startsWith("after-reader"))?.baseCommit,
      ).toBe(result.baseCommit);
    } finally {
      await result.fixture.dispose();
    }
  });
});
