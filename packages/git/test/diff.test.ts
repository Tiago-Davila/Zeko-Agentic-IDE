import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getFileDiff } from "../src/diff.js";
import { runGit } from "../src/git-cli.js";

const directories: string[] = [];

async function setupRepository(): Promise<{ path: string; baseCommit: string }> {
  const path = await mkdtemp(join(tmpdir(), "zeko-diff-"));
  directories.push(path);
  await runGit("init", ["--quiet"], { cwd: path });
  await runGit("config", ["user.name", "Test User"], { cwd: path });
  await runGit("config", ["user.email", "test@example.invalid"], { cwd: path });
  await writeFile(join(path, "change.txt"), "before\n".repeat(30));
  await runGit("add", ["change.txt"], { cwd: path });
  await runGit("commit", ["--quiet", "-m", "base"], { cwd: path });
  return { path, baseCommit: (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim() };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("getFileDiff", () => {
  it("returns a single file patch in pages with a line cursor", async () => {
    const { path, baseCommit } = await setupRepository();
    await writeFile(join(path, "change.txt"), "after\n".repeat(30));
    await runGit("add", ["change.txt"], { cwd: path });
    await runGit("commit", ["--quiet", "-m", "change"], { cwd: path });
    const resultCommit = (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim();
    const first = await getFileDiff({ cwd: path, baseCommit, resultCommit, path: "change.txt", limit: 6 });
    expect(first.patch).toContain("diff --git a/change.txt b/change.txt");
    expect(first.complete).toBe(false);
    const second = await getFileDiff({ cwd: path, baseCommit, resultCommit, path: "change.txt", offset: first.nextOffset, limit: 100 });
    expect(first.patch + second.patch).toContain("-before");
    expect(first.patch + second.patch).toContain("+after");
    expect(second.complete).toBe(true);
  });

  it("rejects paths that escape the repository", async () => {
    const { path, baseCommit } = await setupRepository();
    await expect(getFileDiff({ cwd: path, baseCommit, resultCommit: baseCommit, path: "../secret" })).rejects.toThrow(/relative repository path/);
    await expect(getFileDiff({ cwd: path, baseCommit, resultCommit: baseCommit, path: "C:\\secret" })).rejects.toThrow(/relative repository path/);
  });
});
