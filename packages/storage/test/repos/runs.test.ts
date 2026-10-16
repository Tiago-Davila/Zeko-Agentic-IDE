import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NodeRun, Run } from "@zeko/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../../src/migrate.js";
import { createRedactor } from "../../src/redactor.js";
import { NodeSqliteDriver } from "../../src/node-sqlite-driver.js";
import { RunsRepository } from "../../src/repos/runs.js";

const dirs: string[] = [];
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "zeko-runs-")); dirs.push(dir);
  const db = new NodeSqliteDriver(join(dir, "db.sqlite")); migrate(db);
  return { db, repo: new RunsRepository(db, createRedactor(), () => Date.parse("2026-01-01T00:00:00Z")) };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const flow = { schemaVersion: 1 as const, id: "sample", name: "Sample", nodes: [{ id: "goal", type: "input" as const, position: { x: 0, y: 0 }, objective: "ship" }], edges: [] };
const run: Run = {
  id: "run-1", projectRoot: "C:/repo", flowId: "sample", flowName: "Sample", flowFile: ".zeko/flows/sample.flow.yaml",
  flowSnapshot: flow, flowHash: "hash", origin: "cli", baseCommit: "abc", warnings: [], status: "running",
  startedAt: "2026-01-01T00:00:00.000Z", totals: { partial: true, estimated: false, consumption: {} },
  hostPid: 42, hostStartedAt: "2026-01-01T00:00:00.000Z", heartbeatAt: "2026-01-01T00:00:00.000Z",
};

describe("run repositories", () => {
  it("creates a project/run with initial node rows and reloads the complete run", async () => {
    const { db, repo } = setup();
    await repo.create(run);
    expect(await repo.get(run.id)).toEqual(run);
    expect(db.prepare("SELECT node_id,status FROM node_runs WHERE run_id=?").all(run.id)).toEqual([{ node_id: "goal", status: "pending" }]);
    db.close();
  });

  it("stores node denials including inferred denials and attempt process outcomes", async () => {
    const { db, repo } = setup(); await repo.create(run);
    const node: NodeRun = {
      id: "node-1", runId: run.id, nodeId: "goal", nodeType: "input", status: "completed",
      confinement: { level: "confined" }, warnings: [], attempts: [], reportState: "not_applicable", denialCheck: "not_available",
      inferredDenials: [{ source: "patch", message: "blocked", target: "secret.ts" }],
    };
    repo.nodeRuns.save(node);
    expect(JSON.parse((db.prepare("SELECT inferred_denials FROM node_runs WHERE id='node-1'").get() as { inferred_denials: string }).inferred_denials)).toEqual(node.inferredDenials);
    db.close();
  });
});
