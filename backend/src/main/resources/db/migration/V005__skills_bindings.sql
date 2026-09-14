CREATE TABLE skills (
    id TEXT NOT NULL PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL,
    skill_path TEXT NOT NULL, fingerprint TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'PROJECT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skills_scope_closed CHECK (scope IN ('PROJECT', 'GLOBAL')),
    CONSTRAINT skills_path_per_project UNIQUE (project_id, skill_path)
);
CREATE TABLE agent_skill_bindings (
    id TEXT NOT NULL PRIMARY KEY, instance_id TEXT NOT NULL REFERENCES agent_instances(id),
    skill_id TEXT NOT NULL REFERENCES skills(id), state TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT agent_skill_bindings_state_closed CHECK (state IN ('ACTIVE', 'DISABLED')),
    CONSTRAINT agent_skill_bindings_unique UNIQUE (instance_id, skill_id)
);
CREATE INDEX skills_project_id_idx ON skills(project_id, created_at);
CREATE INDEX agent_skill_bindings_instance_id_idx ON agent_skill_bindings(instance_id, created_at);
