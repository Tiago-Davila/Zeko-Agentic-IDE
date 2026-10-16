import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "../src/git-cli.js";
import {
  buildGitGrepArgs,
  listProjectFiles,
  parseGrepRecord,
  previewLine,
  searchProjectContents,
  SearchPatternError,
  splitGlobPatterns,
  toGitGlobPathspecs,
} from "../src/project-search.js";

const directories: string[] = [];

async function setupRepository(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "zeko-search-"));
  directories.push(path);
  await runGit("init", ["--quiet"], { cwd: path });
  await mkdir(join(path, "src", "nested"), { recursive: true });
  await mkdir(join(path, "dist"), { recursive: true });
  await writeFile(join(path, ".gitignore"), "dist/\n");
  await writeFile(join(path, "src", "app.ts"), "const Alpha = 1;\nexport const alphabet = Alpha + 1;\n");
  await writeFile(join(path, "src", "nested", "view.tsx"), "render(alpha)\n");
  await writeFile(join(path, "README.md"), "# Alpha docs\n");
  await writeFile(join(path, "dist", "bundle.js"), "alpha\n");
  await runGit("add", ["src/app.ts", ".gitignore"], { cwd: path });
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("listProjectFiles", () => {
  it("lists tracked and untracked files but skips ignored ones", async () => {
    const root = await setupRepository();
    const result = await listProjectFiles(root);
    expect(result.paths).toEqual([".gitignore", "README.md", "src/app.ts", "src/nested/view.tsx"]);
    expect(result.truncated).toBe(false);
  });

  it("requires every whitespace-separated token and honours the limit", async () => {
    const root = await setupRepository();
    expect((await listProjectFiles(root, { filter: "SRC view" })).paths).toEqual(["src/nested/view.tsx"]);
    const limited = await listProjectFiles(root, { limit: 1 });
    expect(limited.paths).toHaveLength(1);
    expect(limited.truncated).toBe(true);
  });
});

describe("searchProjectContents", () => {
  it("finds case-insensitive matches with 1-based columns and skips ignored files", async () => {
    const root = await setupRepository();
    const result = await searchProjectContents(root, { query: "alpha" });
    const byPath = Object.fromEntries(result.files.map((file) => [file.relativePath, file.matches]));
    expect(Object.keys(byPath).sort()).toEqual(["README.md", "src/app.ts", "src/nested/view.tsx"]);
    expect(byPath["src/app.ts"]).toEqual([
      { line: 1, column: 7, matchLength: 5, lineContent: "const Alpha = 1;" },
      { line: 2, column: 14, matchLength: 5, lineContent: "export const alphabet = Alpha + 1;" },
      { line: 2, column: 25, matchLength: 5, lineContent: "export const alphabet = Alpha + 1;" },
    ]);
    expect(result.totalMatches).toBe(5);
  });

  it("applies case, whole-word, include and exclude options", async () => {
    const root = await setupRepository();
    const exact = await searchProjectContents(root, { query: "Alpha", caseSensitive: true, wholeWord: true, includePattern: "*.ts" });
    expect(exact.files.map((file) => [file.relativePath, file.matches.map((match) => match.line)])).toEqual([["src/app.ts", [1, 2]]]);
    const excluded = await searchProjectContents(root, { query: "alpha", excludePattern: "src/" });
    expect(excluded.files.map((file) => file.relativePath)).toEqual(["README.md"]);
  });

  it("supports regular expressions and reports invalid ones", async () => {
    const root = await setupRepository();
    const regex = await searchProjectContents(root, { query: "render\\(\\w+\\)", useRegex: true });
    expect(regex.files[0]?.matches[0]).toMatchObject({ line: 1, column: 1, matchLength: 13 });
    await expect(searchProjectContents(root, { query: "(", useRegex: true })).rejects.toBeInstanceOf(SearchPatternError);
  });

  it("stops at the result cap and marks the result truncated", async () => {
    const root = await setupRepository();
    const result = await searchProjectContents(root, { query: "alpha", maxResults: 2 });
    expect(result.totalMatches).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it("returns an empty result for an empty query", async () => {
    const root = await setupRepository();
    expect(await searchProjectContents(root, { query: "" })).toEqual({ files: [], totalMatches: 0, truncated: false });
  });
});

describe("search helpers", () => {
  it("splits globs on top-level commas only", () => {
    expect(splitGlobPatterns("*.ts, src/{a,b}/** ,")).toEqual(["*.ts", "src/{a,b}/**"]);
  });

  it("anchors bare globs anywhere and expands directories", () => {
    expect(toGitGlobPathspecs("*.ts", false)).toEqual([":(glob)**/*.ts", ":(glob)**/*.ts/**"]);
    expect(toGitGlobPathspecs("dist/", true)).toEqual([":(exclude,glob)**/dist/**"]);
  });

  it("builds fixed-string searches over the whole repository by default", () => {
    expect(buildGitGrepArgs({ query: "-x" })).toEqual([
      "grep", "-n", "-I", "--null", "--no-color", "--untracked", "--no-recurse-submodules", "-i", "--fixed-strings", "-e", "-x", "--", ".",
    ]);
  });

  it("parses NUL-delimited grep records including colons in content", () => {
    expect(parseGrepRecord("a:b.ts\u000012\u0000x: y\r")).toEqual({ path: "a:b.ts", line: 12, content: "x: y" });
    expect(parseGrepRecord("garbage")).toBeUndefined();
  });

  it("clips long lines around the match", () => {
    const line = `${"x".repeat(1000)}needle${"y".repeat(1000)}`;
    const preview = previewLine(line, 1000, 6);
    expect(preview.lineContent.length).toBe(500);
    expect(preview.lineContent.slice(preview.column - 1, preview.column - 1 + preview.matchLength)).toBe("needle");
  });
});
