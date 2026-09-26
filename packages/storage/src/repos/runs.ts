import type { FlowFile, PersistedEvent, Run, RunStorePort } from "@zeko/contracts";
import type { Redactor } from "../redactor.js";
import type { SqlDriver } from "../sql-driver.js";
import { NodeRunsRepository } from "./node-runs.js";
import { EventsRepository } from "./events.js";

const epoch = (value?: string) => value ? Date.parse(value) : null;
const iso = (value: number | null) => value === null ? undefined : new Date(value).toISOString();
const parse = <T>(value: string): T => JSON.parse(value) as T;

export class RunsRepository implements RunStorePort {
  readonly nodeRuns: NodeRunsRepository;
  readonly events: EventsRepository;
  constructor(private readonly db: SqlDriver, private readonly redactor: Redactor, private readonly now = Date.now) {
    this.nodeRuns = new NodeRunsRepository(db, redactor);
    this.events = new EventsRepository(db, redactor);
  }

  async create(run: Run): Promise<void> {
    const safe = this.redactor.redact(run);
    const projectId = this.ensureProject(safe.projectRoot);
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO runs (id,project_id,flow_id,flow_name,flow_file,flow_hash,flow_snapshot,origin,base_commit,
        warnings,status,outcome,hold,started_at,ended_at,cost_usd,cost_partial,cost_estimated,consumption,host_pid,host_started_at,heartbeat_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        safe.id, projectId, safe.flowId, safe.flowName, safe.flowFile, safe.flowHash, JSON.stringify(safe.flowSnapshot),
        safe.origin, safe.baseCommit, JSON.stringify(safe.warnings), safe.status, safe.outcome ?? null, safe.hold ?? null,
        Date.parse(safe.startedAt), epoch(safe.endedAt), safe.totals.amountUsd ?? null, Number(safe.totals.partial),
        Number(safe.totals.estimated), JSON.stringify(safe.totals.consumption), safe.hostPid, Date.parse(safe.hostStartedAt), Date.parse(safe.heartbeatAt));
      for (const node of safe.flowSnapshot.nodes) {
        const model = node.type === "agent" ? node.models?.[node.agent] : undefined;
        this.db.prepare(`INSERT INTO node_runs (id,run_id,node_id,node_type,agent_id,model,status,reason_params,confinement_level,
          warnings,report_state,denial_check,inferred_denials) VALUES (?,?,?,?,?,?,'pending','{}','confined','[]',?,'not_available',NULL)`)
          .run(`${safe.id}:${node.id}`, safe.id, node.id, node.type, node.type === "agent" ? node.agent : null,
            model ? JSON.stringify(this.redactor.redact({ ...model, source: "node" })) : null, node.type === "agent" ? "absent" : "not_applicable");
      }
    });
  }

  async get(runId: string): Promise<Run | undefined> {
    const row = this.db.prepare(`SELECT r.*, p.root_path FROM runs r JOIN projects p ON p.id=r.project_id WHERE r.id=?`).get(runId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const endedAt = iso(row["ended_at"] as number | null);
    const startedAt = iso(row["started_at"] as number) as string;
    const hostStartedAt = iso(row["host_started_at"] as number) as string;
    const heartbeatAt = iso(row["heartbeat_at"] as number) as string;
    const consumption = parse<Run["totals"]["consumption"]>(row["consumption"] as string);
    return {
      id: row["id"] as string, projectRoot: row["root_path"] as string, flowId: row["flow_id"] as string,
      flowName: row["flow_name"] as string, flowFile: row["flow_file"] as string,
      flowSnapshot: parse<FlowFile>(row["flow_snapshot"] as string), flowHash: row["flow_hash"] as string,
      origin: row["origin"] as Run["origin"], baseCommit: row["base_commit"] as string,
      warnings: parse<Run["warnings"]>(row["warnings"] as string), status: row["status"] as Run["status"],
      ...(row["outcome"] ? { outcome: row["outcome"] as Run["outcome"] } : {}), ...(row["hold"] ? { hold: row["hold"] as Run["hold"] } : {}),
      startedAt, ...(endedAt ? { endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt) } : {}),
      totals: { ...(row["cost_usd"] === null ? {} : { amountUsd: row["cost_usd"] as number }),
        partial: Boolean(row["cost_partial"]), estimated: Boolean(row["cost_estimated"]), consumption },
      hostPid: row["host_pid"] as number, hostStartedAt, heartbeatAt,
    };
  }

  async append(event: PersistedEvent): Promise<void> {
    const safe = this.redactor.redact(event);
    await this.events.append(safe);
  }

  async saveFlowSnapshot(runId: string, flow: FlowFile): Promise<void> {
    this.db.prepare("UPDATE runs SET flow_snapshot=? WHERE id=?").run(JSON.stringify(this.redactor.redact(flow)), runId);
  }

  update(run: Run): void {
    const safe = this.redactor.redact(run);
    this.db.prepare(`UPDATE runs SET status=?,outcome=?,hold=?,ended_at=?,cost_usd=?,cost_partial=?,cost_estimated=?,
      consumption=?,heartbeat_at=? WHERE id=?`).run(safe.status, safe.outcome ?? null, safe.hold ?? null,
      epoch(safe.endedAt), safe.totals.amountUsd ?? null, Number(safe.totals.partial), Number(safe.totals.estimated),
      JSON.stringify(safe.totals.consumption), Date.parse(safe.heartbeatAt), safe.id);
  }

  runningHosts(): Array<{ runId: string; hostPid: number; hostStartedAt: number }> {
    return this.db.prepare("SELECT id AS runId,host_pid AS hostPid,host_started_at AS hostStartedAt FROM runs WHERE status='running'").all() as Array<{ runId: string; hostPid: number; hostStartedAt: number }>;
  }

  markInterrupted(runId: string, at: string): void {
    this.db.prepare("UPDATE runs SET status='interrupted',ended_at=?,heartbeat_at=? WHERE id=? AND status='running'")
      .run(Date.parse(at), Date.parse(at), runId);
  }

  private ensureProject(root: string): string {
    const id = root;
    this.db.prepare("INSERT INTO projects(id,root_path,created_at) VALUES (?,?,?) ON CONFLICT(root_path) DO NOTHING").run(id, root, this.now());
    const row = this.db.prepare("SELECT id FROM projects WHERE root_path=?").get(root) as { id: string };
    return row.id;
  }
}
