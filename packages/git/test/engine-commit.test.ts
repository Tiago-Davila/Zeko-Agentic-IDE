import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { commitWorkspaceChanges } from "../src/engine-commit.js";
import { runGit } from "../src/git-cli.js";

const directories: string[] = [];

async function setupRepository(): Promise<{ path: string; baseCommit: string }> {
  const path = await mkdtemp(join(tmpdir(), "zeko-engine-commit-"));
  directories.push(path);
  await runGit("init", ["--quiet"], { cwd: path });
  await runGit("config", ["user.name", "Test User"], { cwd: path });
  await runGit("config", ["user.email", "test@example.invalid"], { cwd: path });
  await writeFile(join(path, "file.txt"), "base\n");
  await runGit("add", ["file.txt"], { cwd: path });
  await runGit("commit", ["--quiet", "-m", "base"], { cwd: path });
  return { path, baseCommit: (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim() };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("commitWorkspaceChanges", () => {
  it("does not create a commit after cancellation", async () => {
    const { path, baseCommit } = await setupRepository();
    await writeFile(join(path, "file.txt"), "uncommitted\n");
    const result = await commitWorkspaceChanges({ workspacePath: path, baseCommit, cancelled: true });
    expect(result).toEqual({ committed: false, historyRewritten: false });
    expect((await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim()).toBe(baseCommit);
  });

  it("commits staged workspace contents with Zeko identity and ignores hooks", async () => {
    const { path, baseCommit } = await setupRepository();
    await writeFile(join(path, "file.txt"), "agent change\n");
    const result = await commitWorkspaceChanges({ workspacePath: path, baseCommit });
    expect(result).toMatchObject({ committed: true, historyRewritten: false });
    expect(result.resultCommit).not.toBe(baseCommit);
    await expect(runGit("show", ["-s", "--format=%an <%ae>", "HEAD"], { cwd: path })).resolves.toMatchObject({ stdout: "Zeko <zeko@localhost>\n" });
    expect((await runGit("show", ["--format=", "--name-only", "HEAD"], { cwd: path })).stdout).toContain("file.txt");
  });

  it("detects when the base commit is no longer an ancestor", async () => {
    const { path, baseCommit } = await setupRepository();
    await writeFile(join(path, "file.txt"), "replacement\n");
    await runGit("add", ["file.txt"], { cwd: path });
    await runGit("checkout", ["--quiet", "--orphan", "rewritten-history"], { cwd: path });
    await runGit("add", ["-A"], { cwd: path });
    await runGit("commit", ["--quiet", "-m", "rewritten history"], { cwd: path });
    await expect(commitWorkspaceChanges({ workspacePath: path, baseCommit })).resolves.toMatchObject({ committed: false, historyRewritten: true });
  });
});
