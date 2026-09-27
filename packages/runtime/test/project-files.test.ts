import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "@zeko/git";
import { ProjectFiles, ProjectFilesError } from "../src/project-files.js";

const directories: string[] = [];

async function setupProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zeko-files-"));
  directories.push(root);
  await runGit("init", ["--quiet"], { cwd: root });
  await mkdir(join(root, "src", "Beta"), { recursive: true });
  await mkdir(join(root, "alpha"));
  await writeFile(join(root, "src", "b.ts"), "needle\n");
  await writeFile(join(root, "src", "a.ts"), "hay\n");
  await writeFile(join(root, "Zeta.md"), "needle\n");
  return root;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("ProjectFiles", () => {
  it("lists folders first, hides .git and returns slash-separated relative paths", async () => {
    const files = new ProjectFiles(await setupProject());
    expect((await files.readDir("")).map((entry) => [entry.relativePath, entry.isDirectory])).toEqual([
      ["alpha", true], ["src", true], ["Zeta.md", false],
    ]);
    expect((await files.readDir("src")).map((entry) => entry.relativePath)).toEqual(["src/Beta", "src/a.ts", "src/b.ts"]);
  });

  it("rejects paths that escape the project root", async () => {
    const files = new ProjectFiles(await setupProject());
    await expect(files.readDir("../")).rejects.toBeInstanceOf(ProjectFilesError);
    await expect(files.readDir("src/../../outside")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });

  it("filters file names and searches contents inside the project", async () => {
    const files = new ProjectFiles(await setupProject());
    expect((await files.list("ts", 10)).paths).toEqual(["src/a.ts", "src/b.ts"]);
    const result = await files.search({ query: "needle", caseSensitive: false });
    expect(result.files.map((file) => file.relativePath).sort()).toEqual(["Zeta.md", "src/b.ts"]);
  });

  it("rejects malformed search requests", async () => {
    const files = new ProjectFiles(await setupProject());
    await expect(files.search({ query: 42 })).rejects.toMatchObject({ code: "INVALID_FILES_REQUEST" });
    await expect(files.search(null)).rejects.toMatchObject({ code: "INVALID_FILES_REQUEST" });
  });
});
