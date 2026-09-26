import { NormalizedEventSchema, type NormalizedEvent, type PersistedEvent } from "@zeko/contracts";
import type { Redacted, Redactor } from "../redactor.js";
import type { SqlDriver } from "../sql-driver.js";
import { RawLogWriter } from "../raw-log.js";

interface QueuedEvent { event: Redacted<PersistedEvent>; resolve: () => void; reject: (error: unknown) => void }

export class EventsRepository {
  readonly #queue: QueuedEvent[] = [];
  #timer: ReturnType<typeof setTimeout> | undefined;
  #flushing: Promise<void> | undefined;

  constructor(private readonly db: SqlDriver, private readonly redactor: Redactor, private readonly logs = new RawLogWriter(), private readonly batchMs = 50) {
    if (batchMs < 1 || batchMs > 50) throw new RangeError("Event batch interval must be between 1 and 50ms");
  }

  append(event: Redacted<PersistedEvent>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.#queue.push({ event, resolve, reject });
      if (!this.#timer) this.#timer = setTimeout(() => { void this.flush(); }, this.batchMs);
    });
  }

  async flush(): Promise<void> {
    if (this.#flushing) return this.#flushing;
    if (this.#timer) { clearTimeout(this.#timer); this.#timer = undefined; }
    if (!this.#queue.length) return;
    const batch = this.#queue.splice(0);
    this.#flushing = (async () => {
      try {
        const seqs: number[] = [];
        this.db.transaction(() => {
          const insert = this.db.prepare("INSERT INTO events(run_id,node_run_id,attempt_id,ts,type,payload) VALUES (?,?,?,?,?,?)");
          for (const { event } of batch) {
            const payload = event.payload as Record<string, unknown>;
            if (event.type === "node.attempt_started" && event.attemptId && event.nodeRunId) {
              this.db.prepare(`INSERT INTO attempts(id,node_run_id,n,kind,started_at)
                VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run(event.attemptId, event.nodeRunId,
                Number(payload["n"]), String(payload["kind"]), Date.parse(event.ts));
            } else if (event.type === "node.attempt_finished" && event.attemptId) {
              this.db.prepare("UPDATE attempts SET process_outcome=?,ended_at=? WHERE id=?")
                .run(JSON.stringify(payload["processOutcome"]), Date.parse(event.ts), event.attemptId);
            }
            const result = insert.run(event.runId, event.nodeRunId ?? null, event.attemptId ?? null, Date.parse(event.ts), event.type, JSON.stringify(event.payload));
            seqs.push(Number(result.lastInsertRowid));
          }
        });
        await Promise.all(batch.map(async ({ event }, index) => {
          const node = event.nodeRunId
            ? this.db.prepare("SELECT node_id FROM node_runs WHERE id=?").get(event.nodeRunId) as { node_id: string } | undefined
            : undefined;
          await this.logs.append(this.redactor.redact(event), node?.node_id ?? "run", seqs[index] ?? 0);
        }));
        batch.forEach(({ resolve }) => resolve());
      } catch (error) {
        batch.forEach(({ reject }) => reject(error));
      } finally {
        this.#flushing = undefined;
        if (this.#queue.length && !this.#timer) this.#timer = setTimeout(() => { void this.flush(); }, this.batchMs);
      }
    })();
    return this.#flushing;
  }

  page(runId: string, nodeId: string, afterSeq = 0, limit = 500): { events: NormalizedEvent[]; nextSeq: number | null } {
    if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) throw new RangeError("Event page limit must be 1..5000");
    const rows = this.db.prepare(`SELECT e.seq,e.attempt_id,e.ts,e.type,e.payload FROM events e
      JOIN node_runs n ON n.id=e.node_run_id WHERE e.run_id=? AND n.node_id=? AND e.seq>?
      AND e.type IN ('agent.session_started','agent.text','agent.tool_call','agent.tool_result','agent.permission_denied',
      'agent.inferred_denial','agent.usage','agent.subscription_usage','agent.stderr') ORDER BY e.seq LIMIT ?`)
      .all(runId, nodeId, afterSeq, limit) as Array<{ seq: number; attempt_id: string | null; ts: number; type: string; payload: string }>;
    const events = rows.map(toNormalizedEvent).filter((event): event is NormalizedEvent => event !== undefined);
    return { events, nextSeq: rows.at(-1)?.seq ?? null };
  }
}

function toNormalizedEvent(row: { attempt_id: string | null; ts: number; type: string; payload: string }): NormalizedEvent | undefined {
  if (!row.attempt_id) return undefined;
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  const base = { ts: new Date(row.ts).toISOString(), attemptId: row.attempt_id };
  let value: unknown;
  switch (row.type) {
    case "agent.session_started": value = { ...base, type: "session_started", ...payload }; break;
    case "agent.text": value = { ...base, type: "assistant_text", ...payload }; break;
    case "agent.tool_call": value = { ...base, type: "tool_call", ...payload }; break;
    case "agent.tool_result": value = { ...base, type: "tool_result", ...payload }; break;
    case "agent.permission_denied": value = { ...base, type: "permission_denied", ...payload }; break;
    case "agent.inferred_denial": value = { ...base, type: "inferred_denial", ...payload }; break;
    case "agent.usage": value = { ...base, type: "usage", ...payload }; break;
    case "agent.subscription_usage": value = { ...base, type: "subscription_usage", ...payload }; break;
    case "agent.stderr": value = { ...base, type: "stderr", ...payload }; break;
    default: return undefined;
  }
  const parsed = NormalizedEventSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
