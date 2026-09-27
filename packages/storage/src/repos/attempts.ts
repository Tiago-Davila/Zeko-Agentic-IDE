import type { Attempt } from "@zeko/contracts";
import type { SqlDriver } from "../sql-driver.js";

export class AttemptsRepository {
  constructor(private readonly db: SqlDriver) {}

  save(nodeRunId: string, attempt: Attempt): void {
    this.db.prepare(`INSERT INTO attempts(id,node_run_id,n,kind,session_id,process_outcome,started_at,ended_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      session_id=excluded.session_id,process_outcome=excluded.process_outcome,ended_at=excluded.ended_at`)
      .run(attempt.id, nodeRunId, attempt.n, attempt.kind, attempt.sessionId ?? null,
        attempt.processOutcome === undefined ? null : JSON.stringify(attempt.processOutcome),
        Date.parse(attempt.startedAt), attempt.endedAt ? Date.parse(attempt.endedAt) : null);
  }
}
