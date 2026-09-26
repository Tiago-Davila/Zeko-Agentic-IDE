import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "../src/git-cli.js";
import { assertSafeWorktreePath, createWorktree, getWorktreeRoot } from "../src/worktree.js";

const directories: string[] = [];

async function tempDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "zeko-worktree-"));
  directories.push(path);
  return path;
}

async function initializeRepository(path: string): Promise<string> {
  await runGit("init", ["--quiet"], { cwd: path });
  await runGit("config", ["user.name", "Zeko Test"], { cwd: path });
  await runGit("config", ["user.email", "zeko-test@example.invalid"], { cwd: path });
  await writeFile(join(path, "base.txt"), "base\n");
  await runGit("add", ["base.txt"], { cwd: path });
  await runGit("commit", ["--quiet", "-m", "initial"], { cwd: path });
  return (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim();
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("worktrees", () => {
  it("uses the platform data directory outside the repository", () => {
    expect(
      getWorktreeRoot({
        platform: "win32",
        env: { ["LOCALAPPDATA"]: "C:\\Users\\test\\AppData\\Local" },
      }),
    ).toBe("C:\\Users\\test\\AppData\\Local\\Zeko\\wt");
    expect(
      getWorktreeRoot({
        platform: "linux",
        env: { ["XDG_DATA_HOME"]: "/home/test/.local/share" },
      }).replaceAll("\\", "/"),
    ).toBe("/home/test/.local/share/Zeko/wt");
  });

  it("rejects paths inside the repository or system temp directory", async () => {
    const root = await tempDirectory();
    expect(() =>
      assertSafeWorktreePath({
        repoPath: root,
        worktreePath: join(root, "nested"),
        tempDirectory: "C:\\temp",
        platform: "win32",
      }),
    ).toThrow(/outside the original repository/);
    expect(() =>
      assertSafeWorktreePath({
        repoPath: "C:\\repo",
        worktreePath: "C:\\temp\\zeko",
        tempDirectory: "C:\\temp",
        platform: "win32",
      }),
    ).toThrow(/temporary directory/);
  });

  it("creates an isolated worktree from the requested commit", async () => {
    const parent = await tempDirectory();
    const repo = join(parent, "repo");
    const localData =
      process.platform === "win32" ? process.env["LOCALAPPDATA"] : process.env["XDG_DATA_HOME"];
    const outsideRoot = join(
      localData ?? join(homedir(), ".local", "share"),
      `zeko-test-worktrees-${process.pid}-${Date.now()}`,
    );
    directories.push(outsideRoot);
    await Promise.all([mkdir(repo), mkdir(outsideRoot, { recursive: true })]);
    const baseCommit = await initializeRepository(repo);
    try {
      const workspace = await createWorktree({
        repoPath: repo,
        runId: "12345678-aaaa",
        nodeId: "agent-a",
        baseCommit,
        worktreeRoot: outsideRoot,
      });
      expect(workspace.branch).toBe("zeko/12345678/agent-a");
      expect((await runGit("rev-parse", ["HEAD"], { cwd: workspace.path })).stdout.trim()).toBe(
        baseCommit,
      );
      expect((await runGit("status", ["--porcelain"], { cwd: repo })).stdout).toBe("");
      await runGit("worktree", ["remove", "--force", workspace.path], { cwd: repo });
      await runGit("branch", ["-D", workspace.branch], { cwd: repo });
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("returns WORKSPACE_CREATE_FAILED for a worktree under system temp", async () => {
    const parent = await tempDirectory();
    await expect(
      createWorktree({
        repoPath: parent,
        runId: "12345678-aaaa",
        nodeId: "agent-a",
        baseCommit: "HEAD",
        worktreeRoot: join(tmpdir(), "zeko-forbidden"),
      }),
    ).rejects.toMatchObject({ code: "WORKSPACE_CREATE_FAILED" });
  });
});
