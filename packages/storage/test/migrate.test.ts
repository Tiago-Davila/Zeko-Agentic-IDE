import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeSqliteDriver } from "../src/node-sqlite-driver.js";
import { migrate } from "../src/migrate.js";

const dirs: string[] = [];
function open() {
  const dir = mkdtempSync(join(tmpdir(), "zeko-migrate-")); dirs.push(dir);
  const db = new NodeSqliteDriver(join(dir, "zeko.db"));
  return { db, dir };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("storage migrations", () => {
  it("applies the initial schema exactly once and persists model provenance", () => {
    const { db } = open();
    expect(migrate(db)).toBe(1);
    expect(migrate(db)).toBe(1);
    const columns = db.prepare("PRAGMA table_info(node_runs)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain("inferred_denials");
    expect(columns.map((column) => column.name)).toContain("model");
    const model = { model: "gpt-6-luna", reasoningEffort: "low", source: "project_default" };
    db.prepare("INSERT INTO projects VALUES (?, ?, ?)").run("p", "C:/repo", 1);
    db.prepare(`INSERT INTO runs (id,project_id,flow_id,flow_name,flow_file,flow_hash,flow_snapshot,origin,base_commit,warnings,status,started_at,cost_partial,cost_estimated,consumption,host_pid,host_started_at,heartbeat_at)
      VALUES ('r','p','f','Flow','f.yaml','hash','{}','cli','abc','[]','running',1,1,0,'{}',1,1,1)`).run();
    db.prepare(`INSERT INTO node_runs (id,run_id,node_id,node_type,model,status,reason_params,confinement_level,warnings,report_state,denial_check)
      VALUES ('n','r','agent','agent',?,'pending','{}','confined','[]','not_applicable','not_available')`).run(JSON.stringify(model));
    expect(JSON.parse((db.prepare("SELECT model FROM node_runs WHERE id='n'").get() as { model: string }).model)).toEqual(model);
    db.close();
  });

  it("refuses to open a database from a newer schema", () => {
    const { db } = open();
    db.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL); INSERT INTO schema_migrations VALUES (2, 1)");
    expect(() => migrate(db)).toThrow(/newer than this application/);
    db.close();
  });
});
