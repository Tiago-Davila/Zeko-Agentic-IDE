import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGit } from "../src/git-cli.js";

const directories: string[] = [];

async function tempDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "zeko-git-cli-"));
  directories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("runGit", () => {
  it("executes git and returns stdout", async () => {
    const cwd = await tempDirectory();
    const result = await runGit("init", ["--quiet"], { cwd });
    expect(result.stdout).toBe("");
    await expect(runGit("rev-parse", ["--is-inside-work-tree"], { cwd })).resolves.toMatchObject({
      stdout: "true\n",
    });
  });

  it("exposes command context and stderr on failure", async () => {
    const cwd = await tempDirectory();
    await expect(runGit("rev-parse", ["--show-toplevel"], { cwd })).rejects.toMatchObject({
      name: "GitCommandError",
      context: { command: "rev-parse", args: ["--show-toplevel"], cwd, exitCode: 128 },
    });
  });

  it("reports a missing executable with its command context", async () => {
    const cwd = await tempDirectory();
    await expect(
      runGit("status", [], { cwd, gitPath: "zeko-git-binary-that-does-not-exist" }),
    ).rejects.toMatchObject({
      name: "GitCommandError",
      context: { command: "status", args: [], cwd },
    });
  });
});
