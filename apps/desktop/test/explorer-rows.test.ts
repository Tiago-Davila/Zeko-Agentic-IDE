import { describe, expect, it } from "vitest";
import { buildFilteredRows, buildSearchRows, flattenTree, splitMatchPreview, splitRelativePath } from "../src/renderer/explorer/explorer-rows.js";

const dir = (relativePath: string) => ({ name: relativePath.split("/").at(-1) ?? "", relativePath, isDirectory: true, isSymlink: false });
const file = (relativePath: string) => ({ ...dir(relativePath), isDirectory: false });

describe("flattenTree", () => {
  it("shows children only for expanded, loaded folders", () => {
    const cache = new Map([["", [dir("src"), dir("docs"), file("README.md")]], ["src", [file("src/app.ts")]]]);
    const rows = flattenTree(cache, new Set(["src", "docs"]), new Set(["docs"]));
    expect(rows.map((row) => [row.relativePath, row.depth, row.expanded, row.loading])).toEqual([
      ["src", 0, true, false], ["src/app.ts", 1, false, false], ["docs", 0, true, true], ["README.md", 0, false, false],
    ]);
  });
});

describe("buildFilteredRows", () => {
  it("rebuilds folder context from matching paths with folders first", () => {
    const rows = buildFilteredRows(["src/b.ts", "a.ts", "src/lib/c.ts"]);
    expect(rows.map((row) => `${"  ".repeat(row.depth)}${row.name}`)).toEqual(["src", "  lib", "    c.ts", "  b.ts", "a.ts"]);
    expect(rows[0]).toMatchObject({ isDirectory: true, expanded: true });
  });

  it("hides the contents of folders collapsed while filtering", () => {
    const rows = buildFilteredRows(["src/b.ts", "src/lib/c.ts"], new Set(["src/lib"]));
    expect(rows.map((row) => row.relativePath)).toEqual(["src", "src/lib", "src/b.ts"]);
  });
});

describe("search rows", () => {
  const result = {
    files: [{ relativePath: "src/a.ts", matches: [{ line: 3, column: 5, matchLength: 3, lineContent: "let foo = 1" }] }],
    totalMatches: 1, truncated: false,
  };

  it("emits header rows and omits matches of collapsed files", () => {
    expect(buildSearchRows(result, new Set()).map((row) => row.type)).toEqual(["file", "match"]);
    expect(buildSearchRows(result, new Set(["src/a.ts"]))).toEqual([{ type: "file", relativePath: "src/a.ts", matchCount: 1, collapsed: true }]);
    expect(buildSearchRows(undefined, new Set())).toEqual([]);
  });

  it("splits the highlighted match and left-truncates long prefixes", () => {
    expect(splitMatchPreview({ line: 1, column: 5, matchLength: 3, lineContent: "let foo = 1" })).toEqual({ before: "let ", match: "foo", after: " = 1" });
    const long = splitMatchPreview({ line: 1, column: 41, matchLength: 3, lineContent: `${"a".repeat(40)}foo` });
    expect(long.before).toBe(`…${"a".repeat(26)}`);
    expect(long.match).toBe("foo");
  });

  it("splits relative paths into name and directory", () => {
    expect(splitRelativePath("src/lib/a.ts")).toEqual({ name: "a.ts", directory: "src/lib" });
    expect(splitRelativePath("a.ts")).toEqual({ name: "a.ts", directory: "" });
  });
});
