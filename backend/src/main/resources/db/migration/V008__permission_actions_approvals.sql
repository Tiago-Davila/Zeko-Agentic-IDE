CREATE TABLE agent_runtime_settings (
    instance_id TEXT NOT NULL PRIMARY KEY REFERENCES agent_instances(id),
    permission_mode TEXT NOT NULL DEFAULT 'ASK_APPROVAL',
    autonomy_mode TEXT NOT NULL DEFAULT 'MANUAL',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT runtime_settings_permission_closed CHECK (permission_mode IN ('ASK_APPROVAL', 'AUTO_APPROVE', 'FULL_ACCESS')),
    CONSTRAINT runtime_settings_autonomy_closed CHECK (autonomy_mode IN ('MANUAL', 'ASSISTED', 'AUTONOMOUS')),
    CONSTRAINT runtime_settings_version_positive CHECK (version >= 1)
);

CREATE TABLE permission_policies (
    id TEXT NOT NULL PRIMARY KEY,
    runtime_settings_id TEXT NOT NULL UNIQUE REFERENCES agent_runtime_settings(instance_id),
    permission_mode TEXT NOT NULL,
    auto_approve_rules TEXT NOT NULL DEFAULT '[]',
    constitutional_prohibitions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT permission_policies_mode_closed CHECK (permission_mode IN ('ASK_APPROVAL', 'AUTO_APPROVE', 'FULL_ACCESS'))
);

CREATE TABLE action_proposals (
    id TEXT NOT NULL PRIMARY KEY,
    execution_id TEXT NOT NULL,
    agent_instance_id TEXT,
    task_id TEXT,
    action_type TEXT NOT NULL,
    current_revision INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT action_proposals_revision_positive CHECK (current_revision >= 1),
    CONSTRAINT action_proposals_type_not_blank CHECK (length(trim(action_type)) > 0)
);

CREATE TABLE action_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    action_proposal_id TEXT NOT NULL REFERENCES action_proposals(id),
    revision INTEGER NOT NULL,
    resource TEXT NOT NULL,
    scope TEXT NOT NULL,
    working_directory TEXT NOT NULL,
    arguments TEXT NOT NULL,
    network_target TEXT NOT NULL DEFAULT '',
    expected_effects TEXT NOT NULL,
    classification TEXT NOT NULL,
    CONSTRAINT action_revisions_revision_positive CHECK (revision >= 1),
    CONSTRAINT action_revisions_unique_revision UNIQUE (action_proposal_id, revision),
    CONSTRAINT action_revisions_classification_closed CHECK (
        classification IN ('READ_LOCAL', 'WRITE_LOCAL', 'EXECUTE_LOCAL', 'NETWORK', 'DESTRUCTIVE', 'PROHIBITED'))
);

CREATE TABLE approvals (
    id TEXT NOT NULL PRIMARY KEY,
    action_proposal_id TEXT NOT NULL REFERENCES action_proposals(id),
    action_revision INTEGER NOT NULL,
    state TEXT NOT NULL,
    decided_by TEXT,
    decided_at TEXT,
    reason TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT approvals_revision_positive CHECK (action_revision >= 1),
    CONSTRAINT approvals_state_closed CHECK (state IN ('PENDING', 'APPROVED', 'DENIED', 'INVALIDATED')),
    CONSTRAINT approvals_version_positive CHECK (version >= 1)
);

CREATE INDEX permission_policies_settings_idx ON permission_policies(runtime_settings_id);
CREATE INDEX action_revisions_action_idx ON action_revisions(action_proposal_id, revision);
CREATE INDEX approvals_action_state_idx ON approvals(action_proposal_id, state);
