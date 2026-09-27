import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../../src/migrate.js";
import { NodeSqliteDriver } from "../../src/node-sqlite-driver.js";
import { RunsRepository } from "../../src/repos/runs.js";
import { WorkspacesRepository } from "../../src/repos/workspaces.js";
import { ApprovalsRepository } from "../../src/repos/approvals.js";
import { ProcessTreeRepository } from "../../src/repos/process-tree.js";
import { createRedactor } from "../../src/redactor.js";

const dirs: string[] = [];
function setup() { const dir = mkdtempSync(join(tmpdir(), "zeko-extra-repos-")); dirs.push(dir); const db = new NodeSqliteDriver(join(dir, "db.sqlite")); migrate(db); return { db, runs: new RunsRepository(db, createRedactor()) }; }
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const flow = { schemaVersion: 1 as const, id: "f", name: "F", nodes: [{ id: "a", type: "input" as const, position: { x: 0, y: 0 }, objective: "x" }], edges: [] };
const run = { id: "r", projectRoot: "C:/r", flowId: "f", flowName: "F", flowFile: "f.yaml", flowSnapshot: flow, flowHash: "h", origin: "cli" as const, baseCommit: "abc", warnings: [], status: "running" as const, startedAt: "2026-01-01T00:00:00.000Z", totals: { partial: true, estimated: false, consumption: {} }, hostPid: 1, hostStartedAt: "2026-01-01T00:00:00.000Z", heartbeatAt: "2026-01-01T00:00:00.000Z" };

describe("workspace, approval, and process-tree repositories", () => {
  it("records and updates workspace trust, approval decisions, and exact process identities", async () => {
    const { db, runs } = setup(); await runs.create(run);
    const attempts = runs.nodeRuns.attempts;
    attempts.save("r:a", { id: "018f0000-0000-7000-8000-000000000001", n: 1, kind: "agent", workspacePath: "C:/wt", startedAt: "2026-01-01T00:00:00.000Z" });
    const workspaces = new WorkspacesRepository(db);
    workspaces.save({ id: "w", nodeRunId: "r:a", attemptId: "018f0000-0000-7000-8000-000000000001", path: "C:/wt", branch: "zeko/r/a", baseCommit: "abc", trust: "trusted", state: "active", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(workspaces.markUntrusted("r:a")).toBe(1);
    expect(db.prepare("SELECT trust FROM workspaces WHERE id='w'").get()).toEqual({ trust: "untrusted" });

    const approvals = new ApprovalsRepository(db);
    approvals.save({ id: "approval", runId: "r", nodeRunId: "r:a", decision: "approved", origin: "cli", decidedAt: "2026-01-01T00:00:01.000Z" });
    expect(approvals.forRun("r")[0]?.decision).toBe("approved");

    const processes = new ProcessTreeRepository(db);
    processes.record({ attemptId: "018f0000-0000-7000-8000-000000000001", pid: 101, creationTime: 999, isRoot: true, firstSeen: 1, lastSeen: 2 });
    processes.record({ attemptId: "018f0000-0000-7000-8000-000000000001", pid: 101, creationTime: 1000, isRoot: true, firstSeen: 3, lastSeen: 4 });
    expect(processes.forAttempt("018f0000-0000-7000-8000-000000000001", false)).toHaveLength(2);
    processes.markEnded("018f0000-0000-7000-8000-000000000001", 101, 999, 5);
    expect(processes.forAttempt("018f0000-0000-7000-8000-000000000001", false)).toHaveLength(1);
    db.close();
  });
});
