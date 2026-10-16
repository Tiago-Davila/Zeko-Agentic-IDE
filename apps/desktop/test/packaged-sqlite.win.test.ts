import { DatabaseSync } from "node:sqlite";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspace = resolve(import.meta.dirname, "../../..");

/*
 * Async on purpose: the build and packaging take minutes, and a sync child process blocks the
 * worker so it cannot answer Vitest's RPC ("Timeout calling onTaskUpdate").
 */
function runPnpm(args: string[]): Promise<{ status: number | null; output: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("pnpm", args, { cwd: workspace, shell: true, windowsHide: true });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (status) => resolvePromise({ status, output }));
  });
}

function runExecutable(file: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile(file, args, { cwd: workspace, env, timeout: 30_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${error.message}\n${stdout}\n${stderr}`));
      else resolvePromise();
    });
  });
}

describe("packaged Electron node:sqlite smoke", () => {
  it("opens and migrates SQLite inside the packaged engine host on Windows x64", async () => {
    for (const args of [["build"], ["--filter", "@zeko/desktop", "run", "package:win"]]) {
      const result = await runPnpm(args);
      expect(result.status, result.output).toBe(0);
    }

    const temporary = await mkdtemp(join(tmpdir(), "zeko-packaged-sqlite-"));
    const databasePath = join(temporary, "packaged.db");
    const executable = join(workspace, "dist", "desktop", "win-unpacked", "Zeko.exe");
    try {
      await runExecutable(executable, ["--zeko-sqlite-smoke"], { ...process.env, ZEKO_DATABASE_PATH: databasePath });
      const database = new DatabaseSync(databasePath);
      try {
        expect(database.prepare("SELECT version FROM schema_migrations").get()).toEqual({ version: 1 });
      } finally { database.close(); }
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }, 300_000);
});
