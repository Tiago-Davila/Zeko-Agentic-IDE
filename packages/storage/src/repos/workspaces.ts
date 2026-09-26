import type { IsolatedWorkspace } from "@zeko/contracts";
import type { SqlDriver } from "../sql-driver.js";

export interface StoredWorkspace extends IsolatedWorkspace {
  id: string;
  nodeRunId: string;
  attemptId: string;
  createdAt: string;
  deletedAt?: string;
}

export class WorkspacesRepository {
  constructor(private readonly db: SqlDriver) {}

  save(workspace: StoredWorkspace): void {
    this.db.prepare(`INSERT INTO workspaces(id,node_run_id,attempt_id,path,branch,base_commit,trust,state,created_at,deleted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET trust=excluded.trust,state=excluded.state,deleted_at=excluded.deleted_at`)
      .run(workspace.id, workspace.nodeRunId, workspace.attemptId, workspace.path, workspace.branch, workspace.baseCommit,
        workspace.trust, workspace.state, Date.parse(workspace.createdAt), workspace.deletedAt ? Date.parse(workspace.deletedAt) : null);
  }

  markUntrusted(nodeRunId: string): number {
    return Number(this.db.prepare("UPDATE workspaces SET trust='untrusted' WHERE node_run_id=? AND state!='deleted'").run(nodeRunId).changes);
  }

  markDeleted(id: string, deletedAt = new Date().toISOString()): void {
    this.db.prepare("UPDATE workspaces SET state='deleted',deleted_at=? WHERE id=?").run(Date.parse(deletedAt), id);
  }
}
