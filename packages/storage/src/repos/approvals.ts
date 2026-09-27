import type { SqlDriver } from "../sql-driver.js";

export interface StoredApproval {
  id: string;
  runId: string;
  nodeRunId: string;
  decision: "approved" | "rejected";
  origin: "desktop" | "cli";
  decidedAt: string;
}

export class ApprovalsRepository {
  constructor(private readonly db: SqlDriver) {}
  save(approval: StoredApproval): void {
    this.db.prepare(`INSERT INTO approvals(id,run_id,node_run_id,decision,origin,decided_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET decision=excluded.decision,origin=excluded.origin,decided_at=excluded.decided_at`)
      .run(approval.id, approval.runId, approval.nodeRunId, approval.decision, approval.origin, Date.parse(approval.decidedAt));
  }
  forRun(runId: string): StoredApproval[] {
    return (this.db.prepare("SELECT id,run_id,node_run_id,decision,origin,decided_at FROM approvals WHERE run_id=? ORDER BY decided_at")
      .all(runId) as Array<Record<string, unknown>>).map((row) => ({
      id: row["id"] as string, runId: row["run_id"] as string, nodeRunId: row["node_run_id"] as string,
      decision: row["decision"] as StoredApproval["decision"], origin: row["origin"] as StoredApproval["origin"],
      decidedAt: new Date(row["decided_at"] as number).toISOString(),
    }));
  }
}
