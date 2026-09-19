CREATE TABLE tasks (
    id TEXT NOT NULL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    repository_id TEXT NOT NULL REFERENCES repositories(id),
    agent_instance_id TEXT NOT NULL REFERENCES agent_instances(id),
    instruction_id TEXT NOT NULL REFERENCES instructions(id),
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    blocked_reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT tasks_state_closed CHECK (state IN ('DRAFT','READY','RUNNING','COMPLETED','FAILED','CANCELLED','BLOCKED'))
);
CREATE TABLE executions (
    id TEXT NOT NULL PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    attempt INTEGER NOT NULL,
    state TEXT NOT NULL,
    retry_of TEXT REFERENCES executions(id),
    known_state TEXT NOT NULL,
    cancellation_requested INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT executions_attempt_positive CHECK (attempt >= 1),
    CONSTRAINT executions_state_closed CHECK (state IN ('PENDING','RUNNING','WAITING_APPROVAL','COMPLETED','FAILED','CANCELLED')),
    CONSTRAINT executions_task_attempt_unique UNIQUE (task_id, attempt)
);
CREATE TABLE execution_snapshots (
    execution_id TEXT NOT NULL PRIMARY KEY REFERENCES executions(id),
    template_id TEXT NOT NULL REFERENCES agent_templates(id),
    template_version INTEGER NOT NULL,
    agent_identity TEXT NOT NULL,
    context TEXT NOT NULL,
    CONSTRAINT execution_snapshots_template_version_positive CHECK (template_version >= 1)
);
CREATE TABLE effect_records (
    id TEXT NOT NULL PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(id),
    sequence INTEGER NOT NULL,
    effect_type TEXT NOT NULL,
    resource TEXT NOT NULL,
    confirmed INTEGER NOT NULL,
    safe_detail TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT effect_records_sequence_positive CHECK (sequence >= 1),
    CONSTRAINT effect_records_execution_sequence UNIQUE (execution_id, sequence)
);
CREATE INDEX tasks_repository_state_idx ON tasks(repository_id, state);
CREATE INDEX executions_task_attempt_idx ON executions(task_id, attempt);
CREATE INDEX effect_records_execution_idx ON effect_records(execution_id, sequence);
