import type { NodeRun } from "@zeko/contracts";
import type { Redactor } from "../redactor.js";
import type { SqlDriver } from "../sql-driver.js";
import { AttemptsRepository } from "./attempts.js";

const epoch = (value?: string) => value ? Date.parse(value) : null;
const json = (value: unknown) => value === undefined ? null : JSON.stringify(value);

export class NodeRunsRepository {
  readonly attempts: AttemptsRepository;
  constructor(private readonly db: SqlDriver, private readonly redactor: Redactor) {
    this.attempts = new AttemptsRepository(db);
  }

  save(nodeRun: NodeRun): void {
    const safe = this.redactor.redact(nodeRun);
    this.db.prepare(`INSERT INTO node_runs (id,run_id,node_id,node_type,agent_id,model,status,reason_code,reason_params,hold,
      confinement_level,confinement_reason,warnings,base_commit,result_commit,report,report_state,observed_files,discrepancies,
      denials,denial_check,inferred_denials,inconsistency,cost_usd,cost_basis,consumption,started_at,ended_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(run_id,node_id) DO UPDATE SET id=excluded.id,node_type=excluded.node_type,agent_id=excluded.agent_id,
      model=excluded.model,status=excluded.status,reason_code=excluded.reason_code,reason_params=excluded.reason_params,
      hold=excluded.hold,base_commit=excluded.base_commit,result_commit=excluded.result_commit,report=excluded.report,
      report_state=excluded.report_state,observed_files=excluded.observed_files,discrepancies=excluded.discrepancies,
      denials=excluded.denials,denial_check=excluded.denial_check,inferred_denials=excluded.inferred_denials,
      inconsistency=excluded.inconsistency,cost_usd=excluded.cost_usd,cost_basis=excluded.cost_basis,
      consumption=excluded.consumption,started_at=excluded.started_at,ended_at=excluded.ended_at`)
      .run(safe.id, safe.runId, safe.nodeId, safe.nodeType, safe.agentId ?? null, json(safe.model), safe.status,
        safe.reason?.code ?? null, JSON.stringify(safe.reason?.params ?? {}), safe.hold ?? null,
        safe.confinement.level, safe.confinement.reason ?? null, JSON.stringify(safe.warnings), safe.baseCommit ?? null,
        safe.resultCommit ?? null, json(safe.report), safe.reportState, json(safe.observedFiles), json(safe.discrepancies),
        json(safe.denials), safe.denialCheck, json(safe.inferredDenials), safe.inconsistency ?? null,
        safe.cost?.amountUsd ?? null, safe.cost?.basis ?? null, json(safe.consumption), epoch(safe.startedAt), epoch(safe.endedAt));
    for (const attempt of safe.attempts) this.attempts.save(safe.id, attempt);
  }

  nonterminal(runId: string): Array<{ id: string; nodeId: string; status: NodeRun["status"] }> {
    return this.db.prepare(`SELECT id,node_id AS nodeId,status FROM node_runs WHERE run_id=?
      AND status NOT IN ('completed','blocked','failed','cancelled','skipped','interrupted','rejected','approved')`)
      .all(runId) as Array<{ id: string; nodeId: string; status: NodeRun["status"] }>;
  }

  markRecovered(id: string, status: "interrupted" | "skipped"): void {
    this.db.prepare("UPDATE node_runs SET status=? WHERE id=?").run(status, id);
  }
}
