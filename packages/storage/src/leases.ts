import type { SlotLeasePort } from "@zeko/contracts";
import type { SqlDriver } from "./sql-driver.js";

export interface SqliteSlotLeaseOptions {
  hostPid?: number;
  hostStartedAt?: number;
  now?: () => number;
  isHostAlive?: (pid: number, startedAt: number) => boolean;
  heartbeatIntervalMs?: number;
}

export class SqliteSlotLeases implements SlotLeasePort {
  readonly #hostPid: number;
  readonly #hostStartedAt: number;
  readonly #now: () => number;
  readonly #isHostAlive: (pid: number, startedAt: number) => boolean;
  readonly #heartbeatIntervalMs: number;
  readonly #owned = new Set<string>();
  #timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly db: SqlDriver, options: SqliteSlotLeaseOptions = {}) {
    this.#hostPid = options.hostPid ?? process.pid;
    this.#hostStartedAt = options.hostStartedAt ?? Date.now() - process.uptime() * 1_000;
    this.#now = options.now ?? Date.now;
    this.#isHostAlive = options.isHostAlive ?? ((pid) => {
      try { process.kill(pid, 0); return true; } catch { return false; }
    });
    this.#heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5_000;
    if (this.#heartbeatIntervalMs < 1) throw new RangeError("Heartbeat interval must be positive");
  }

  async acquire(projectId: string, nodeRunId: string, limit: number): Promise<boolean> {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Slot limit must be positive");
    const now = this.#now();
    const acquired = this.db.transaction(() => {
      const leases = this.db.prepare("SELECT node_run_id,host_pid,host_started_at FROM slot_leases").all() as Array<{ node_run_id: string; host_pid: number; host_started_at: number }>;
      const purge = this.db.prepare("DELETE FROM slot_leases WHERE node_run_id=?");
      for (const lease of leases) if (!this.#isHostAlive(lease.host_pid, lease.host_started_at)) purge.run(lease.node_run_id);
      const existing = this.db.prepare("SELECT host_pid,host_started_at FROM slot_leases WHERE project_id=? AND node_run_id=?").get(projectId, nodeRunId) as { host_pid: number; host_started_at: number } | undefined;
      if (existing) return existing.host_pid === this.#hostPid && existing.host_started_at === this.#hostStartedAt;
      const count = this.db.prepare("SELECT COUNT(*) AS count FROM slot_leases WHERE project_id=?").get(projectId) as { count: number };
      if (count.count >= limit) return false;
      this.db.prepare(`INSERT INTO slot_leases(project_id,node_run_id,host_pid,host_started_at,acquired_at,heartbeat_at)
        VALUES (?,?,?,?,?,?)`).run(projectId, nodeRunId, this.#hostPid, this.#hostStartedAt, now, now);
      return true;
    });
    if (acquired) { this.#owned.add(nodeRunId); this.#startHeartbeat(); }
    return acquired;
  }

  async heartbeat(nodeRunId: string): Promise<void> {
    if (!this.#owned.has(nodeRunId)) throw new Error(`No slot lease for ${nodeRunId}`);
    const result = this.db.prepare(`UPDATE slot_leases SET heartbeat_at=? WHERE node_run_id=? AND host_pid=? AND host_started_at=?`)
      .run(this.#now(), nodeRunId, this.#hostPid, this.#hostStartedAt);
    if (Number(result.changes) !== 1) { this.#owned.delete(nodeRunId); throw new Error(`Slot lease expired: ${nodeRunId}`); }
  }

  async release(nodeRunId: string): Promise<void> {
    this.db.prepare("DELETE FROM slot_leases WHERE node_run_id=? AND host_pid=? AND host_started_at=?")
      .run(nodeRunId, this.#hostPid, this.#hostStartedAt);
    this.#owned.delete(nodeRunId);
    if (!this.#owned.size) this.#stopHeartbeat();
  }

  close(): void { this.#stopHeartbeat(); }

  #startHeartbeat(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      for (const nodeRunId of this.#owned) void this.heartbeat(nodeRunId).catch(() => undefined);
    }, this.#heartbeatIntervalMs);
    this.#timer.unref?.();
  }
  #stopHeartbeat(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = undefined; }
}
