import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../../src/migrate.js";
import { createRedactor } from "../../src/redactor.js";
import { NodeSqliteDriver } from "../../src/node-sqlite-driver.js";
import { EventsRepository } from "../../src/repos/events.js";
import { RunsRepository } from "../../src/repos/runs.js";
import { RawLogWriter } from "../../src/raw-log.js";

const dirs: string[] = [];
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "zeko-events-")); dirs.push(dir);
  const db = new NodeSqliteDriver(join(dir, "db.sqlite")); migrate(db);
  const redactor = createRedactor();
  const runs = new RunsRepository(db, redactor);
  const events = new EventsRepository(db, redactor, new RawLogWriter(join(dir, "logs")), 20);
  return { db, redactor, runs, events, dir };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const flow = { schemaVersion: 1 as const, id: "sample", name: "Sample", nodes: [{ id: "agent", type: "input" as const, position: { x: 0, y: 0 }, objective: "ship" }], edges: [] };
const run = { id: "run-events", projectRoot: "C:/repo", flowId: "sample", flowName: "Sample", flowFile: "sample.yaml", flowSnapshot: flow, flowHash: "h", origin: "cli" as const, baseCommit: "abc", warnings: [], status: "running" as const, startedAt: "2026-01-01T00:00:00.000Z", totals: { partial: true, estimated: false, consumption: {} }, hostPid: 1, hostStartedAt: "2026-01-01T00:00:00.000Z", heartbeatAt: "2026-01-01T00:00:00.000Z" };

describe("events repository", () => {
  it("batches redacted events, writes raw JSONL, and pages normalized events by node", async () => {
    const { db, redactor, runs, events, dir } = setup();
    await runs.create(run);
    redactor.registerSensitiveValue("injected-secret");
    const base = { runId: run.id, nodeRunId: `${run.id}:agent`, attemptId: "018f0000-0000-7000-8000-000000000001", ts: "2026-01-01T00:00:01.000Z" };
    await Promise.all([
      events.append(redactor.redact({ ...base, type: "node.attempt_started", payload: { attemptId: base.attemptId, n: 1, kind: "agent", workspace: { path: "C:/wt" }, confinement: { level: "confined" } } }) as never),
      events.append(redactor.redact({ ...base, type: "agent.text", payload: { text: "prefix injected-secret" } }) as never),
      events.append(redactor.redact({ ...base, type: "agent.text", payload: { text: "second" } }) as never),
    ]);
    expect(db.prepare("SELECT seq,node_run_id,type,payload FROM events").all()).toHaveLength(3);
    expect(db.prepare("SELECT id,node_id FROM node_runs WHERE run_id=?").all(run.id)).toEqual([{ id: `${run.id}:agent`, node_id: "agent" }]);
    const page = events.page(run.id, "agent", 0, 1);
    expect(page.events).toEqual([{ type: "assistant_text", ts: base.ts, attemptId: base.attemptId, text: "prefix [REDACTED:api_key]" }]);
    expect(page.nextSeq).toBe(2);
    expect(events.page(run.id, "agent", page.nextSeq ?? 0, 10).events).toHaveLength(1);
    const logs = readFileSync(join(dir, "logs", run.id, `agent-${base.attemptId}.jsonl`), "utf8");
    expect(logs).toContain("[REDACTED:api_key]");
    expect(logs).not.toContain("injected-secret");
    db.close();
  });
});
