CREATE TABLE memory_entries (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'PROJECT', 'AGENT', 'CONVERSATION')),
  project_id TEXT NULL REFERENCES projects(id),
  owner_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  fingerprint TEXT NOT NULL DEFAULT '',
  index_state TEXT NOT NULL CHECK (index_state IN ('CURRENT', 'STALE', 'UNAVAILABLE', 'EXCLUDED')),
  sensitive INTEGER NOT NULL DEFAULT 0 CHECK (sensitive IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX memory_entries_scope_owner_idx ON memory_entries(scope, owner_id);
CREATE INDEX memory_entries_project_idx ON memory_entries(project_id);
