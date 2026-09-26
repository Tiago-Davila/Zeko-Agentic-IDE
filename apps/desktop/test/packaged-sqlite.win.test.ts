import { DatabaseSync } from "node:sqlite";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspace = resolve(import.meta.dirname, "../../..");

describe("packaged Electron node:sqlite smoke", () => {
  it("opens and migrates SQLite inside the packaged engine host on Windows x64", async () => {
    for (const args of [["build"], ["--filter", "@zeko/desktop", "run", "package:win"]]) {
      const result = spawnSync("pnpm", args, { cwd: workspace, encoding: "utf8", shell: true, windowsHide: true });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }

    const temporary = await mkdtemp(join(tmpdir(), "zeko-packaged-sqlite-"));
    const databasePath = join(temporary, "packaged.db");
    const executable = join(workspace, "dist", "desktop", "win-unpacked", "Zeko.exe");
    try {
      try {
        execFileSync(executable, ["--zeko-sqlite-smoke"], {
          cwd: workspace,
          env: { ...process.env, ZEKO_DATABASE_PATH: databasePath },
          timeout: 30_000,
          windowsHide: true,
          stdio: "pipe",
        });
      } catch (error) {
        const failure = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
        throw new Error(`${String(failure.message)}\n${String(failure.stdout ?? "")}\n${String(failure.stderr ?? "")}`);
      }
      const database = new DatabaseSync(databasePath);
      try {
        expect(database.prepare("SELECT version FROM schema_migrations").get()).toEqual({ version: 1 });
      } finally { database.close(); }
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }, 300_000);
});
