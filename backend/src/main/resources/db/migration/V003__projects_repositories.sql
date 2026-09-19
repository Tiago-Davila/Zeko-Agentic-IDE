CREATE TABLE projects (
    id         TEXT    NOT NULL PRIMARY KEY,
    name       TEXT    NOT NULL,
    root_path  TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version    INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT projects_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT projects_version_positive CHECK (version >= 1)
);

CREATE TABLE repositories (
    id              TEXT    NOT NULL PRIMARY KEY,
    project_id      TEXT    NOT NULL REFERENCES projects(id),
    normalized_path TEXT    NOT NULL,
    git_root        TEXT,
    access_state    TEXT    NOT NULL,
    fingerprint     TEXT,
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version         INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT repositories_access_state_closed CHECK (access_state IN ('AVAILABLE', 'UNAVAILABLE', 'INVALID')),
    CONSTRAINT repositories_version_positive CHECK (version >= 1),
    CONSTRAINT repositories_path_per_project UNIQUE (project_id, normalized_path)
);

CREATE INDEX repositories_project_id_idx ON repositories(project_id, created_at);
