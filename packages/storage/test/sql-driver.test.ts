import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeSqliteDriver } from "../src/node-sqlite-driver.js";

const dirs: string[] = [];
function database() {
  const dir = mkdtempSync(join(tmpdir(), "zeko-sql-driver-"));
  dirs.push(dir);
  return new NodeSqliteDriver(join(dir, "test.db"));
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("NodeSqliteDriver", () => {
  it("sets WAL, FULL durability, busy timeout, and foreign keys", () => {
    const db = database();
    expect(db.prepare("PRAGMA journal_mode").get()).toMatchObject({ journal_mode: "wal" });
    expect(db.prepare("PRAGMA synchronous").get()).toMatchObject({ synchronous: 2 });
    expect(db.prepare("PRAGMA busy_timeout").get()).toMatchObject({ timeout: 5000 });
    expect(db.prepare("PRAGMA foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
    db.close();
  });

  it("commits work and rolls back failures", () => {
    const db = database();
    db.exec("CREATE TABLE item(value INTEGER)");
    db.transaction(() => db.prepare("INSERT INTO item VALUES (?)").run(1));
    expect(() => db.transaction(() => { db.prepare("INSERT INTO item VALUES (?)").run(2); throw new Error("abort"); })).toThrow("abort");
    expect(db.prepare("SELECT value FROM item").all()).toEqual([{ value: 1 }]);
    db.close();
  });
});
