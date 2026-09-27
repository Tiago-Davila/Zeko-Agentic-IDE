import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getObservedFiles } from "../src/observed-files.js";
import { runGit } from "../src/git-cli.js";

const directories: string[] = [];

async function setupRepository(): Promise<{ path: string; baseCommit: string }> {
  const path = await mkdtemp(join(tmpdir(), "zeko-observed-"));
  directories.push(path);
  await runGit("init", ["--quiet"], { cwd: path });
  await runGit("config", ["user.name", "Test User"], { cwd: path });
  await runGit("config", ["user.email", "test@example.invalid"], { cwd: path });
  await writeFile(join(path, ".gitattributes"), "*.txt -text\n");
  await writeFile(join(path, "dir"), "initial\n");
  await runGit("add", ["."], { cwd: path });
  await runGit("commit", ["--quiet", "-m", "base"], { cwd: path });
  return { path, baseCommit: (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim() };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("getObservedFiles", () => {
  it("returns slash-normalized paths and marks CRLF-only changes", async () => {
    const { path, baseCommit } = await setupRepository();
    await writeFile(join(path, "dir"), "initial\r\n");
    await writeFile(join(path, "line-endings.txt"), "same\r\nsecond\r\n");
    await runGit("add", ["."], { cwd: path });
    await runGit("commit", ["--quiet", "-m", "add CRLF content"], { cwd: path });
    const previous = (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim();
    await writeFile(join(path, "line-endings.txt"), "same\nsecond\n");
    await runGit("add", ["line-endings.txt"], { cwd: path });
    await runGit("commit", ["--quiet", "-m", "change line endings"], { cwd: path });
    const resultCommit = (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim();
    const observed = await getObservedFiles({ cwd: path, baseCommit: previous, resultCommit });
    expect(observed).toEqual([{ path: "line-endings.txt", change: "M", eolOnly: true }]);
    expect(baseCommit).not.toBe(resultCommit);
  });

  it("parses added, modified, and deleted files from NUL-delimited output", async () => {
    const { path, baseCommit } = await setupRepository();
    await writeFile(join(path, "dir"), "modified\n");
    await writeFile(join(path, "added file.txt"), "new\n");
    await runGit("add", ["dir", "added file.txt"], { cwd: path });
    await runGit("commit", ["--quiet", "-m", "modify and add"], { cwd: path });
    const middle = (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim();
    const { unlink } = await import("node:fs/promises");
    await unlink(join(path, "dir"));
    await runGit("add", ["-A"], { cwd: path });
    await runGit("commit", ["--quiet", "-m", "delete"], { cwd: path });
    const end = (await runGit("rev-parse", ["HEAD"], { cwd: path })).stdout.trim();
    await expect(getObservedFiles({ cwd: path, baseCommit, resultCommit: middle })).resolves.toEqual([
      { path: "added file.txt", change: "A", eolOnly: false },
      { path: "dir", change: "M", eolOnly: false },
    ]);
    await expect(getObservedFiles({ cwd: path, baseCommit: middle, resultCommit: end })).resolves.toEqual([
      { path: "dir", change: "D", eolOnly: false },
    ]);
  });
});
