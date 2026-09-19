CREATE TABLE worktrees (
    id TEXT NOT NULL PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id),
    task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id),
    logical_path TEXT NOT NULL,
    physical_path TEXT NOT NULL,
    state TEXT NOT NULL,
    owner_execution_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT worktrees_state_closed CHECK (state IN ('RESERVED','ACTIVE','RELEASE_PENDING','RELEASED','CONFLICTED'))
);
CREATE UNIQUE INDEX worktrees_active_path_unique ON worktrees(physical_path)
WHERE state IN ('RESERVED','ACTIVE','RELEASE_PENDING','CONFLICTED');
CREATE UNIQUE INDEX worktrees_active_owner_unique ON worktrees(owner_execution_id)
WHERE owner_execution_id IS NOT NULL AND state IN ('ACTIVE','RELEASE_PENDING','CONFLICTED');
CREATE TABLE conflict_records (
    id TEXT NOT NULL PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    conflict_type TEXT NOT NULL,
    resources TEXT NOT NULL,
    state TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    resolution TEXT NOT NULL DEFAULT '',
    CONSTRAINT conflict_records_type_closed CHECK (conflict_type IN ('WORKTREE_OWNERSHIP','MANUAL_INTEGRATION')),
    CONSTRAINT conflict_records_state_closed CHECK (state IN ('OPEN','CANCELLED','REASSIGNED','RESOLVED_MANUALLY'))
);
CREATE INDEX conflict_records_task_idx ON conflict_records(task_id, state);
