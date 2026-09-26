import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupRunWorktrees } from "../src/cleanup.js";
import { runGit } from "../src/git-cli.js";

const directories: string[] = [];

async function setup(): Promise<{ repo: string; root: string; worktree: string; branch: string }> {
  const parent = await mkdtemp(join(tmpdir(), "zeko-cleanup-"));
  directories.push(parent);
  const repo = join(parent, "repo");
  const localData = process.platform === "win32" ? process.env.LOCALAPPDATA : process.env.XDG_DATA_HOME;
  const root = join(localData ?? join(homedir(), ".local", "share"), `zeko-test-cleanup-${process.pid}-${Date.now()}`);
  directories.push(root);
  await Promise.all([mkdir(repo), mkdir(root, { recursive: true })]);
  await runGit("init", ["--quiet"], { cwd: repo });
  await runGit("config", ["user.name", "Test User"], { cwd: repo });
  await runGit("config", ["user.email", "test@example.invalid"], { cwd: repo });
  await writeFile(join(repo, "base.txt"), "base\n");
  await runGit("add", ["base.txt"], { cwd: repo });
  await runGit("commit", ["--quiet", "-m", "base"], { cwd: repo });
  const runId = "12345678-aaaa";
  const branch = "zeko/12345678/agent-a";
  const worktree = join(root, "12345678", "agent-a");
  await runGit("worktree", ["add", "-b", branch, worktree, "HEAD"], { cwd: repo });
  return { repo, root, worktree, branch };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("cleanupRunWorktrees", () => {
  it("does not remove anything without explicit confirmation", async () => {
    const fixture = await setup();
    await expect(cleanupRunWorktrees({
      repoPath: fixture.repo,
      worktreeRoot: fixture.root,
      runId: "12345678-aaaa",
      workspaces: [{ path: fixture.worktree, branch: fixture.branch }],
    })).resolves.toEqual({ removed: [], confirmationRequired: true });
    await expect(runGit("rev-parse", ["--show-toplevel"], { cwd: fixture.worktree })).resolves.toMatchObject({ stdout: expect.any(String) });
    await expect(runGit("show-ref", ["--verify", `refs/heads/${fixture.branch}`], { cwd: fixture.repo })).resolves.toMatchObject({ stdout: expect.any(String) });
  });

  it("removes only selected run worktrees after confirmation", async () => {
    const fixture = await setup();
    const result = await cleanupRunWorktrees({
      repoPath: fixture.repo,
      worktreeRoot: fixture.root,
      runId: "12345678-aaaa",
      workspaces: [{ path: fixture.worktree, branch: fixture.branch }],
      confirmed: true,
    });
    expect(result).toEqual({ removed: [fixture.worktree], confirmationRequired: false });
    await expect(runGit("show-ref", ["--verify", `refs/heads/${fixture.branch}`], { cwd: fixture.repo })).rejects.toMatchObject({ context: { exitCode: 128 } });
  });
});
