import type { SqlDriver } from "../sql-driver.js";

export const INITIAL_SCHEMA = `
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  flow_id TEXT NOT NULL, flow_name TEXT NOT NULL, flow_file TEXT NOT NULL, flow_hash TEXT NOT NULL,
  flow_snapshot TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('desktop','cli')),
  base_commit TEXT NOT NULL, warnings TEXT NOT NULL,
  status TEXT NOT NULL, outcome TEXT NULL, hold TEXT NULL,
  started_at INTEGER NOT NULL, ended_at INTEGER NULL,
  cost_usd REAL NULL, cost_partial INTEGER NOT NULL, cost_estimated INTEGER NOT NULL,
  consumption TEXT NOT NULL,
  host_pid INTEGER NOT NULL, host_started_at INTEGER NOT NULL, heartbeat_at INTEGER NOT NULL
);
CREATE INDEX runs_project_flow_started ON runs(project_id, flow_id, started_at DESC);
CREATE INDEX runs_status ON runs(status);
CREATE TABLE node_runs (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), node_id TEXT NOT NULL, node_type TEXT NOT NULL,
  agent_id TEXT NULL, model TEXT NULL,
  status TEXT NOT NULL, reason_code TEXT NULL, reason_params TEXT NOT NULL, hold TEXT NULL,
  confinement_level TEXT NOT NULL, confinement_reason TEXT NULL, warnings TEXT NOT NULL,
  base_commit TEXT NULL, result_commit TEXT NULL,
  report TEXT NULL, report_state TEXT NOT NULL,
  observed_files TEXT NULL, discrepancies TEXT NULL, denials TEXT NULL,
  denial_check TEXT NOT NULL, inferred_denials TEXT NULL, inconsistency TEXT NULL,
  cost_usd REAL NULL, cost_basis TEXT NULL, consumption TEXT NULL,
  started_at INTEGER NULL, ended_at INTEGER NULL,
  UNIQUE(run_id, node_id)
);
CREATE INDEX node_runs_run ON node_runs(run_id);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY, node_run_id TEXT NOT NULL REFERENCES node_runs(id), n INTEGER NOT NULL, kind TEXT NOT NULL,
  session_id TEXT NULL, process_outcome TEXT NULL, started_at INTEGER NOT NULL, ended_at INTEGER NULL
);
CREATE INDEX attempts_node ON attempts(node_run_id, n);
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY, node_run_id TEXT NOT NULL REFERENCES node_runs(id), attempt_id TEXT NOT NULL REFERENCES attempts(id),
  path TEXT NOT NULL, branch TEXT NOT NULL, base_commit TEXT NOT NULL,
  trust TEXT NOT NULL CHECK (trust IN ('trusted','untrusted')),
  state TEXT NOT NULL CHECK (state IN ('active','kept','deleted')),
  created_at INTEGER NOT NULL, deleted_at INTEGER NULL
);
CREATE TABLE process_tree (
  attempt_id TEXT NOT NULL REFERENCES attempts(id), pid INTEGER NOT NULL, creation_time INTEGER NOT NULL,
  parent_pid INTEGER NULL, is_root INTEGER NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
  ended_at INTEGER NULL, PRIMARY KEY(attempt_id, pid, creation_time)
);
CREATE TABLE approvals (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), node_run_id TEXT NOT NULL REFERENCES node_runs(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  origin TEXT NOT NULL CHECK (origin IN ('desktop','cli')), decided_at INTEGER NOT NULL
);
CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id),
  node_run_id TEXT NULL REFERENCES node_runs(id), attempt_id TEXT NULL REFERENCES attempts(id),
  ts INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX events_run_seq ON events(run_id, seq);
CREATE INDEX events_node_seq ON events(node_run_id, seq);
CREATE TABLE agent_usage (
  agent_id TEXT NOT NULL, auth_mode TEXT NOT NULL, window TEXT NOT NULL, utilization REAL NOT NULL,
  resets_at INTEGER NULL, read_at INTEGER NOT NULL, live INTEGER NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY(agent_id, window)
);
CREATE TABLE slot_leases (
  project_id TEXT NOT NULL, node_run_id TEXT PRIMARY KEY, host_pid INTEGER NOT NULL, host_started_at INTEGER NOT NULL,
  acquired_at INTEGER NOT NULL, heartbeat_at INTEGER NOT NULL
);
CREATE INDEX slot_leases_project ON slot_leases(project_id);
`;

export function applyInitialMigration(driver: SqlDriver): void {
  driver.exec(INITIAL_SCHEMA);
}
