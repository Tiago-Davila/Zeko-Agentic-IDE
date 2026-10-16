import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "../src/git-cli.js";
import { GitWorkspacePort, workspaceMetadataPath } from "../src/workspace-port.js";

const directories: string[] = [];

async function setupRepository(): Promise<{ repo: string; root: string; baseCommit: string }> {
  const parent = await mkdtemp(join(tmpdir(), "zeko-workspace-port-"));
  directories.push(parent);
  const repo = join(parent, "repo");
  const localData =
    process.platform === "win32" ? process.env["LOCALAPPDATA"] : process.env["XDG_DATA_HOME"];
  const root = join(
    localData ?? join(homedir(), ".local", "share"),
    `zeko-test-workspace-${process.pid}-${Date.now()}`,
  );
  directories.push(root);
  await Promise.all([mkdir(repo), mkdir(root, { recursive: true })]);
  await runGit("init", ["--quiet"], { cwd: repo });
  await runGit("config", ["user.name", "Test User"], { cwd: repo });
  await runGit("config", ["user.email", "test@example.invalid"], { cwd: repo });
  await writeFile(join(repo, "base.txt"), "base\n");
  await runGit("add", ["."], { cwd: repo });
  await runGit("commit", ["--quiet", "-m", "base"], { cwd: repo });
  const baseCommit = (await runGit("rev-parse", ["HEAD"], { cwd: repo })).stdout.trim();
  return { repo, root, baseCommit };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("GitWorkspacePort", () => {
  it("creates and commits an attempt while keeping trust metadata outside the worktree", async () => {
    const { repo, root, baseCommit } = await setupRepository();
    const port = new GitWorkspacePort(repo, root);
    const workspace = await port.create({
      runId: "12345678-aaaa",
      nodeId: "agent-a-attempt-1",
      baseCommit,
    });
    await writeFile(join(workspace.path, "result.txt"), "agent result\n");
    const committed = await port.commit({ path: workspace.path, baseCommit, cancelled: false });
    expect(committed).toMatchObject({ historyRewritten: false });
    expect(committed.resultCommit).toBe(
      (await runGit("rev-parse", ["HEAD"], { cwd: workspace.path })).stdout.trim(),
    );
    const stateFile = workspaceMetadataPath(workspace.path, "agent-a-attempt-1");
    expect(dirname(stateFile)).toBe(dirname(workspace.path));
    expect(JSON.parse(await readFile(stateFile, "utf8"))).toMatchObject({
      trust: "trusted",
      baseCommit,
      branch: workspace.branch,
    });
    await port.markUntrusted(workspace.path);
    expect(JSON.parse(await readFile(stateFile, "utf8"))).toMatchObject({ trust: "untrusted" });
  });

  it("discards a failed attempt and its branch", async () => {
    const { repo, root, baseCommit } = await setupRepository();
    const port = new GitWorkspacePort(repo, root);
    const workspace = await port.create({
      runId: "12345678-aaaa",
      nodeId: "agent-a-attempt-1",
      baseCommit,
    });
    await port.remove(workspace.path);
    await expect(
      runGit("show-ref", ["--verify", `refs/heads/${workspace.branch}`], { cwd: repo }),
    ).rejects.toBeDefined();
  });
});
