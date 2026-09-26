import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, NodeSqliteDriver, createRedactor, RunsRepository, WorkspacesRepository, ProcessTreeRepository } from "@zeko/storage";
import { recoverInterruptedRuns } from "../src/recovery.js";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const flow = { schemaVersion: 1 as const, id: "recover", name: "Recovery", nodes: [
  { id: "goal", type: "input" as const, position: { x: 0, y: 0 }, objective: "ship" },
  { id: "agent", type: "agent" as const, position: { x: 1, y: 0 }, agent: "claude-code" as const,
    instructions: "work", acceptanceCriteria: [], writeScope: [], terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 1, maxTurns: 1, maxRetries: 0 } },
], edges: [] };
const run = { id: "dead-run", projectRoot: "C:/repo", flowId: "recover", flowName: "Recovery", flowFile: "recover.yaml", flowSnapshot: flow, flowHash: "h", origin: "cli" as const, baseCommit: "abc", warnings: [], status: "running" as const, startedAt: "2026-01-01T00:00:00.000Z", totals: { partial: true, estimated: false, consumption: {} }, hostPid: 777, hostStartedAt: "2026-01-01T00:00:00.000Z", heartbeatAt: "2026-01-01T00:00:00.000Z" };

describe("runtime crash recovery", () => {
  it("interrupts dead-host runs, skips pending nodes, untrusts workspaces and terminates only exact live identities", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeko-recovery-")); dirs.push(dir);
    const db = new NodeSqliteDriver(join(dir, "db.sqlite")); migrate(db);
    const redactor = createRedactor(); const runs = new RunsRepository(db, redactor); await runs.create(run);
    db.prepare("UPDATE node_runs SET status='running' WHERE run_id=? AND node_id='agent'").run(run.id);
    const attemptId = "018f0000-0000-7000-8000-000000000001";
    runs.nodeRuns.attempts.save(`${run.id}:agent`, { id: attemptId, n: 1, kind: "agent", workspacePath: "C:/wt", startedAt: run.startedAt });
    new WorkspacesRepository(db).save({ id: "workspace", nodeRunId: `${run.id}:agent`, attemptId, path: "C:/wt", branch: "zeko/recover", baseCommit: "abc", trust: "trusted", state: "active", createdAt: run.startedAt });
    const tree = new ProcessTreeRepository(db);
    tree.record({ attemptId, pid: 101, creationTime: 100, isRoot: true, firstSeen: 1, lastSeen: 1 });
    tree.record({ attemptId, pid: 202, creationTime: 200, parentPid: 101, isRoot: false, firstSeen: 1, lastSeen: 1 });
    const attempted: Array<{ pid: number; creationTime: number }> = [];
    const result = await recoverInterruptedRuns({ db, runs, redactor, now: () => "2026-01-02T00:00:00.000Z",
      hostIsAlive: () => false,
      supervisor: { terminateRecovered: async (identity) => { attempted.push(identity); return identity.pid === 101 && identity.creationTime === 100; } },
    });
    expect(result).toEqual({ runIds: [run.id], terminatedPids: [101] });
    expect(attempted).toEqual([{ pid: 101, creationTime: 100 }, { pid: 202, creationTime: 200 }]);
    expect((await runs.get(run.id))?.status).toBe("interrupted");
    expect(db.prepare("SELECT node_id,status FROM node_runs WHERE run_id=? ORDER BY node_id").all(run.id)).toEqual([
      { node_id: "agent", status: "interrupted" }, { node_id: "goal", status: "skipped" },
    ]);
    expect(db.prepare("SELECT trust FROM workspaces WHERE id='workspace'").get()).toEqual({ trust: "untrusted" });
    expect(db.prepare("SELECT type FROM events WHERE run_id=?").all(run.id)).toContainEqual({ type: "run.interrupted" });
    db.close();
  });
});
