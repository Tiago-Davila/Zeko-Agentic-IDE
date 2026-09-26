import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "../src/git-cli.js";
import { getRepositoryInfo, RepositoryInfoError } from "../src/repo-info.js";

const directories: string[] = [];

async function tempDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "zeko-repo-info-"));
  directories.push(path);
  return path;
}

async function initializeRepository(path: string): Promise<void> {
  await runGit("init", ["--quiet"], { cwd: path });
  await runGit("config", ["user.name", "Zeko Test"], { cwd: path });
  await runGit("config", ["user.email", "zeko-test@example.invalid"], { cwd: path });
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("getRepositoryInfo", () => {
  it("reports a non-repository with a typed diagnostic", async () => {
    const path = await tempDirectory();
    await expect(getRepositoryInfo(path)).rejects.toMatchObject<Partial<RepositoryInfoError>>({ code: "NOT_A_GIT_REPO", path });
  });

  it("reports an unborn repository with NO_COMMITS", async () => {
    const path = await tempDirectory();
    await initializeRepository(path);
    await expect(getRepositoryInfo(path)).rejects.toMatchObject<Partial<RepositoryInfoError>>({ code: "NO_COMMITS", path });
  });

  it("returns HEAD files and indicates uncommitted changes", async () => {
    const path = await tempDirectory();
    await initializeRepository(path);
    await writeFile(join(path, "tracked.txt"), "committed\n");
    await runGit("add", ["tracked.txt"], { cwd: path });
    await runGit("commit", ["--quiet", "-m", "initial"], { cwd: path });
    await writeFile(join(path, "tracked.txt"), "modified\n");
    const info = await getRepositoryInfo(path);
    expect(resolve(info.root)).toBe(resolve(path));
    expect(info).toMatchObject({ uncommittedChanges: true, filesAtHead: ["tracked.txt"] });
    expect(info.head).toMatch(/^[0-9a-f]{40}$/i);
  });
});
