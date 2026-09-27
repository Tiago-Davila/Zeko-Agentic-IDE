import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findSensitiveData } from "@zeko/contracts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const spikesRoot = join(repositoryRoot, "spikes");
const scanRoots = [
  ...readdirSync(spikesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(spikesRoot, entry.name, "samples"))
    .filter(existsSync),
  join(repositoryRoot, "packages/adapters/test/fixtures"),
];

describe("spike samples and curated fixtures", () => {
  it("contains no API keys, bearer tokens, JWTs, auth token values, emails, or account ids", () => {
    const findings = scanRoots.flatMap((root) => collectFiles(root).flatMap((path) =>
      findSensitiveData(readFileSync(path, "utf8")).map(({ kind }) => ({ path: path.slice(repositoryRoot.length + 1), kind })),
    ));
    expect(findings).toEqual([]);
  });
});

function collectFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath);
    if (entry.isFile()) return [entryPath];
    return [];
  });
}
