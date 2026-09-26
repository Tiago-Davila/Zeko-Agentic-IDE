import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const forbiddenImages = [
  new RegExp(`${["task", "kill"].join("")}\\s+[^\\r\\n]*${["/", "I", "M"].join("")}`, "i"),
  new RegExp(`${["Stop", "-", "Process"].join("")}\\s+[^\\r\\n]*${["-", "Name"].join("")}`, "i"),
  new RegExp(`\\b${["p", "kill"].join("")}\\b`, "i"),
  new RegExp(`\\b${["kill", "all"].join("")}\\b`, "i"),
  new RegExp(`${["Get", "-", "Process"].join("")}\\s+[^\\r\\n|]+\\|\\s*${["Stop", "-", "Process"].join("")}`, "i"),
  new RegExp(`${["Get", "-", "CimInstance"].join("")}[^\\r\\n]*(?:\\bName\\b|\\bCommandLine\\b)[^\\r\\n]*(?:taskkill|Stop-Process)`, "i"),
];

describe("process termination safety", () => {
  it("never terminates processes by image name, process name, or command-line pattern", async () => {
    const files = [
      ...await collectFiles(join(root, "packages")),
      ...await collectFiles(join(root, "apps")),
    ];
    const violations: string[] = [];
    for (const file of files) {
      if (relative(root, file).replaceAll("\\", "/") === "packages/adapters/test/process/no-kill-by-name.test.ts") continue;
      const contents = await readFile(file, "utf8");
      for (const [lineIndex, line] of contents.split(/\r?\n/).entries()) {
        if (forbiddenImages.some((pattern) => pattern.test(line))) {
          violations.push(`${relative(root, file)}:${lineIndex + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps all OS process termination primitives inside the supervisor module", async () => {
    const files = [
      ...await collectFiles(join(root, "packages")),
      ...await collectFiles(join(root, "apps")),
    ];
    const outsideSupervisor: string[] = [];
    for (const file of files) {
      if (relative(root, file).replaceAll("\\", "/") === "packages/adapters/test/process/no-kill-by-name.test.ts") continue;
      const contents = await readFile(file, "utf8");
      const usesTerminationPrimitive = /process\.kill\s*\(/.test(contents)
        || /\btaskkill(?:\.exe)?\b/i.test(contents)
        || /\bStop-Process\b/i.test(contents)
        || /\b(?:pkill|killall)\b/i.test(contents)
        || /\.kill\s*\(/.test(contents);
      if (usesTerminationPrimitive && relative(root, file).replaceAll("\\", "/") !== "packages/adapters/src/process/supervisor.ts") {
        outsideSupervisor.push(relative(root, file));
      }
    }
    expect(outsideSupervisor).toEqual([]);
  });
});

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "coverage"].includes(entry.name)) return [];
      return collectFiles(path);
    }
    return sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf("."))) ? [path] : [];
  }));
  return groups.flat();
}
