import type { AgentUsageReading, UsageStorePort } from "@zeko/contracts";
import type { SqlDriver } from "../sql-driver.js";

export class AgentUsageRepository implements UsageStorePort {
  constructor(private readonly db: SqlDriver) {}

  async readLatest(agentId: string, authMode: string): Promise<AgentUsageReading | undefined> {
    const latest = this.db.prepare("SELECT MAX(read_at) AS read_at FROM agent_usage WHERE agent_id=? AND auth_mode=?")
      .get(agentId, authMode) as { read_at: number | null };
    if (latest.read_at === null) return undefined;
    const rows = this.db.prepare(`SELECT window,utilization,resets_at,live,source FROM agent_usage
      WHERE agent_id=? AND auth_mode=? AND read_at=? ORDER BY window`).all(agentId, authMode, latest.read_at) as Array<Record<string, unknown>>;
    const first = rows[0];
    if (!first) return undefined;
    return {
      agentId: agentId as AgentUsageReading["agentId"], authMode: authMode as AgentUsageReading["authMode"],
      windows: rows.map((row) => ({ name: row["window"] as string, utilization: row["utilization"] as number,
        ...(row["resets_at"] === null ? {} : { resetsAt: new Date(row["resets_at"] as number).toISOString() }) })),
      readAt: new Date(latest.read_at).toISOString(), live: Boolean(first["live"]), source: first["source"] as string,
    };
  }

  async write(reading: AgentUsageReading): Promise<void> {
    const readAt = Date.parse(reading.readAt);
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM agent_usage WHERE agent_id=?").run(reading.agentId);
      const insert = this.db.prepare(`INSERT INTO agent_usage(agent_id,auth_mode,window,utilization,resets_at,read_at,live,source)
        VALUES (?,?,?,?,?,?,?,?)`);
      for (const window of reading.windows) insert.run(reading.agentId, reading.authMode, window.name, window.utilization,
        window.resetsAt ? Date.parse(window.resetsAt) : null, readAt, Number(reading.live), reading.source);
    });
  }
}
