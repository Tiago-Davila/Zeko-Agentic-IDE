import type { SqlDriver } from "../sql-driver.js";

export interface ProcessIdentity {
  attemptId: string;
  pid: number;
  creationTime: number;
  parentPid?: number;
  isRoot: boolean;
  firstSeen: number;
  lastSeen: number;
  endedAt?: number;
}

export class ProcessTreeRepository {
  constructor(private readonly db: SqlDriver) {}
  record(process: ProcessIdentity): void {
    this.db.prepare(`INSERT INTO process_tree(attempt_id,pid,creation_time,parent_pid,is_root,first_seen,last_seen,ended_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(attempt_id,pid,creation_time) DO UPDATE SET
      parent_pid=excluded.parent_pid,is_root=excluded.is_root,last_seen=excluded.last_seen,ended_at=excluded.ended_at`)
      .run(process.attemptId, process.pid, process.creationTime, process.parentPid ?? null, Number(process.isRoot),
        process.firstSeen, process.lastSeen, process.endedAt ?? null);
  }
  forAttempt(attemptId: string, includeEnded = true): ProcessIdentity[] {
    const rows = this.db.prepare(`SELECT attempt_id,pid,creation_time,parent_pid,is_root,first_seen,last_seen,ended_at
      FROM process_tree WHERE attempt_id=? ${includeEnded ? "" : "AND ended_at IS NULL"} ORDER BY first_seen,pid`).all(attemptId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ attemptId: row["attempt_id"] as string, pid: row["pid"] as number,
      creationTime: row["creation_time"] as number, ...(row["parent_pid"] === null ? {} : { parentPid: row["parent_pid"] as number }),
      isRoot: Boolean(row["is_root"]), firstSeen: row["first_seen"] as number, lastSeen: row["last_seen"] as number,
      ...(row["ended_at"] === null ? {} : { endedAt: row["ended_at"] as number }) }));
  }
  forRun(runId: string, liveOnly = true): ProcessIdentity[] {
    const rows = this.db.prepare(`SELECT p.attempt_id,p.pid,p.creation_time,p.parent_pid,p.is_root,p.first_seen,p.last_seen,p.ended_at
      FROM process_tree p JOIN attempts a ON a.id=p.attempt_id JOIN node_runs n ON n.id=a.node_run_id
      WHERE n.run_id=? ${liveOnly ? "AND p.ended_at IS NULL" : ""} ORDER BY p.first_seen,p.pid`).all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ attemptId: row["attempt_id"] as string, pid: row["pid"] as number,
      creationTime: row["creation_time"] as number, ...(row["parent_pid"] === null ? {} : { parentPid: row["parent_pid"] as number }),
      isRoot: Boolean(row["is_root"]), firstSeen: row["first_seen"] as number, lastSeen: row["last_seen"] as number,
      ...(row["ended_at"] === null ? {} : { endedAt: row["ended_at"] as number }) }));
  }
  markEnded(attemptId: string, pid: number, creationTime: number, endedAt: number): void {
    this.db.prepare("UPDATE process_tree SET ended_at=?,last_seen=? WHERE attempt_id=? AND pid=? AND creation_time=?")
      .run(endedAt, endedAt, attemptId, pid, creationTime);
  }
}
