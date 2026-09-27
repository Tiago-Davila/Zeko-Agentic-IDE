import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createRedactor } from "../src/redactor.js";
import { migrate } from "../src/migrate.js";
import { NodeSqliteDriver } from "../src/node-sqlite-driver.js";
import { RunsRepository } from "../src/repos/runs.js";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("SQLite crash durability", () => {
  it("retains every event acknowledged by a child killed during a later write", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeko-durability-")); dirs.push(dir);
    const dbPath = join(dir, "zeko.db");
    const db = new NodeSqliteDriver(dbPath); migrate(db);
    const flow = { schemaVersion: 1 as const, id: "durability", name: "Durability", nodes: [{ id: "goal", type: "input" as const, position: { x: 0, y: 0 }, objective: "test" }], edges: [] };
    const run = { id: "durability-run", projectRoot: dir, flowId: flow.id, flowName: flow.name, flowFile: "flow.yaml", flowSnapshot: flow, flowHash: "h", origin: "cli" as const, baseCommit: "abc", warnings: [], status: "running" as const, startedAt: "2026-01-01T00:00:00.000Z", totals: { partial: true, estimated: false, consumption: {} }, hostPid: process.pid, hostStartedAt: "2026-01-01T00:00:00.000Z", heartbeatAt: "2026-01-01T00:00:00.000Z" };
    await new RunsRepository(db, createRedactor()).create(run);
    db.close();

    const storageModule = pathToFileURL(join(process.cwd(), "packages/storage/dist/src/index.js")).href;
    const childSource = `const { NodeSqliteDriver, createRedactor, RunsRepository } = await import(${JSON.stringify(storageModule)});
      const db = new NodeSqliteDriver(${JSON.stringify(dbPath)});
      const store = new RunsRepository(db, createRedactor());
      for (let i = 1; i <= 100; i++) {
        await store.append({ runId: "durability-run", ts: new Date().toISOString(), type: "run.held", payload: { reason: "checkpoint-" + i } });
        console.log("committed:" + i);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      await store.events.flush(); db.close();`;
    const supervisorModule = pathToFileURL(join(process.cwd(), "packages/adapters/src/process/supervisor.ts")).href;
    const { ProcessSupervisor } = await import(supervisorModule);
    const supervisor = new ProcessSupervisor();
    const child = await supervisor.launch(process.execPath, ["--input-type=module", "-e", childSource], { cwd: process.cwd() });
    const committed: number[] = [];
    const iterator = child.stdout[Symbol.asyncIterator]();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          while (committed.length < 4) {
            const next = await iterator.next();
            const match = /^committed:(\d+)$/.exec(next.value ?? "");
            if (match) committed.push(Number(match[1]));
            if (next.done) throw new Error("child exited before four events were committed");
          }
        })(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("child did not commit four events in time")), 15_000); }),
      ]);
    } finally { if (timeout) clearTimeout(timeout); }
    await supervisor.terminate(child.rootPid);
    await child.completion;
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      const match = /^committed:(\d+)$/.exec(next.value);
      if (match) committed.push(Number(match[1]));
    }
    await supervisor.dispose();

    const reopened = new NodeSqliteDriver(dbPath);
    const rows = reopened.prepare("SELECT payload FROM events WHERE run_id=? ORDER BY seq").all(run.id) as Array<{ payload: string }>;
    expect(committed.slice(0, 4)).toEqual([1, 2, 3, 4]);
    const reasons = rows.map(({ payload }) => JSON.parse(payload).reason);
    expect(reasons.length).toBeGreaterThanOrEqual(committed.length);
    expect(reasons.length).toBeLessThan(100);
    expect(reasons).toEqual(reasons.map((_, index) => `checkpoint-${index + 1}`));
    reopened.close();
  }, 25_000);
});
