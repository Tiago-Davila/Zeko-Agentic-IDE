import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../src/migrate.js";
import { NodeSqliteDriver } from "../src/node-sqlite-driver.js";
import { SqliteSlotLeases } from "../src/leases.js";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("SQLite slot leases", () => {
  it("enforces one shared concurrency limit across independent connections and frees dead-host leases", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeko-leases-")); dirs.push(dir);
    const path = join(dir, "zeko.db");
    const firstDb = new NodeSqliteDriver(path); migrate(firstDb);
    const secondDb = new NodeSqliteDriver(path);
    const alive = new Set([101, 202]);
    const common = { now: () => 100, isHostAlive: (pid: number) => alive.has(pid), heartbeatIntervalMs: 5_000 };
    const first = new SqliteSlotLeases(firstDb, { ...common, hostPid: 101, hostStartedAt: 10 });
    const second = new SqliteSlotLeases(secondDb, { ...common, hostPid: 202, hostStartedAt: 20 });
    expect(await first.acquire("project", "node-1", 2)).toBe(true);
    expect(await second.acquire("project", "node-2", 2)).toBe(true);
    expect(await first.acquire("project", "node-3", 2)).toBe(false);
    await second.heartbeat("node-2");
    const heartbeat = (secondDb.prepare("SELECT heartbeat_at FROM slot_leases WHERE node_run_id='node-2'").get() as { heartbeat_at: number }).heartbeat_at;
    expect(heartbeat).toBe(100);
    alive.delete(101);
    expect(await second.acquire("project", "node-3", 2)).toBe(true);
    expect(firstDb.prepare("SELECT node_run_id FROM slot_leases WHERE project_id='project' ORDER BY node_run_id").all()).toEqual([{ node_run_id: "node-2" }, { node_run_id: "node-3" }]);
    await first.release("node-1"); await second.release("node-2"); await second.release("node-3");
    first.close(); second.close(); firstDb.close(); secondDb.close();
  });
});
