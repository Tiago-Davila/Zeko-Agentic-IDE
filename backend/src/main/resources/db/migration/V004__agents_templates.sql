CREATE TABLE agent_templates (
    id         TEXT    NOT NULL PRIMARY KEY,
    project_id TEXT    NOT NULL REFERENCES projects(id),
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version    INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT agent_templates_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT agent_templates_version_positive CHECK (version >= 1),
    CONSTRAINT agent_templates_name_per_project UNIQUE (project_id, name)
);

CREATE TABLE template_versions (
    id            TEXT    NOT NULL PRIMARY KEY,
    template_id   TEXT    NOT NULL REFERENCES agent_templates(id),
    number        INTEGER NOT NULL,
    configuration TEXT    NOT NULL,
    created_at    TEXT    NOT NULL,
    CONSTRAINT template_versions_number_positive CHECK (number >= 1),
    CONSTRAINT template_versions_template_number UNIQUE (template_id, number)
);

CREATE TABLE agent_instances (
    id                        TEXT    NOT NULL PRIMARY KEY,
    project_id                TEXT    NOT NULL REFERENCES projects(id),
    template_id               TEXT    NOT NULL REFERENCES agent_templates(id),
    selected_template_version INTEGER NOT NULL,
    identity                  TEXT    NOT NULL,
    context                   TEXT    NOT NULL,
    state                     TEXT    NOT NULL,
    created_at                TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version                   INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT agent_instances_identity_not_blank CHECK (length(trim(identity)) > 0),
    CONSTRAINT agent_instances_state_not_blank CHECK (length(trim(state)) > 0),
    CONSTRAINT agent_instances_version_positive CHECK (version >= 1),
    FOREIGN KEY (template_id, selected_template_version) REFERENCES template_versions(template_id, number)
);

CREATE TABLE template_update_decisions (
    id                        TEXT    NOT NULL PRIMARY KEY,
    instance_id               TEXT    NOT NULL REFERENCES agent_instances(id),
    previous_template_version INTEGER NOT NULL,
    proposed_template_version INTEGER NOT NULL,
    outcome                   TEXT    NOT NULL,
    decided_at                TEXT    NOT NULL,
    CONSTRAINT template_update_decisions_versions_positive CHECK (
        previous_template_version >= 1 AND proposed_template_version >= 1
    ),
    CONSTRAINT template_update_decisions_versions_differ CHECK (
        previous_template_version <> proposed_template_version
    ),
    CONSTRAINT template_update_decisions_outcome_closed CHECK (outcome IN ('ACCEPTED', 'REJECTED'))
);

CREATE INDEX agent_templates_project_id_idx ON agent_templates(project_id, created_at);
CREATE INDEX agent_instances_project_id_idx ON agent_instances(project_id, created_at);
CREATE INDEX template_update_decisions_instance_id_idx ON template_update_decisions(instance_id, decided_at);
