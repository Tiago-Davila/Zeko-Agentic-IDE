import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { describe, expect, it } from "vitest";
import { validateCommand } from "../src/commands/validate.js";

const execFile = promisify(execFileCallback);
async function initRepo(root: string) {
  await execFile("git", ["init", "--quiet"], { cwd: root });
  await execFile("git", ["config", "user.name", "Test"], { cwd: root });
  await execFile("git", ["config", "user.email", "test@example.invalid"], { cwd: root });
  await writeFile(join(root, "seed.txt"), "seed\n", "utf8");
  await execFile("git", ["add", "."], { cwd: root });
  await execFile("git", ["commit", "--quiet", "-m", "seed"], { cwd: root });
}

describe("zeko validate", () => {
  it("prints the source location and exits 2 for malformed YAML", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-cli-"));
    try {
      await mkdir(join(root, ".zeko/flows"), { recursive: true });
      await writeFile(join(root, ".zeko/flows/broken.flow.yaml"), "schemaVersion: [\n", "utf8");
      await initRepo(root);
      const errors: string[] = [];
      const code = await validateCommand({ flow: "broken", project: root, stderr: (line) => errors.push(line) });
      expect(code).toBe(2); expect(errors[0]).toContain("broken.flow.yaml:2"); expect(errors[0]).toContain("FILE_PARSE_ERROR");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("emits the validation CliEvent as NDJSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-cli-"));
    try {
      await mkdir(join(root, ".zeko/flows"), { recursive: true });
      await writeFile(join(root, ".zeko/flows/minimal.flow.yaml"), "schemaVersion: 1\nid: minimal\nname: Minimal\nnodes: []\nedges: []\n", "utf8");
      await initRepo(root);
      const lines: string[] = [];
      await validateCommand({ flow: "minimal", project: root, json: true, stdout: (line) => lines.push(line) });
      expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ type: "validation", diagnostics: [{ code: "NO_INPUT_NODE" }] });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
