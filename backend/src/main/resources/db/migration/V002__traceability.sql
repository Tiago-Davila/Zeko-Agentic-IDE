CREATE TABLE trace_links (
    id          TEXT NOT NULL PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id   TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    relation    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    CONSTRAINT trace_links_source_type_not_blank CHECK (length(trim(source_type)) > 0),
    CONSTRAINT trace_links_target_type_not_blank CHECK (length(trim(target_type)) > 0),
    CONSTRAINT trace_links_relation_not_blank CHECK (length(trim(relation)) > 0)
);

CREATE TABLE trace_events (
    trace_link_id TEXT NOT NULL PRIMARY KEY REFERENCES trace_links(id),
    safe_detail   TEXT NOT NULL
);

CREATE INDEX trace_links_source_resource_idx ON trace_links(source_type, source_id, created_at);
CREATE INDEX trace_links_target_resource_idx ON trace_links(target_type, target_id, created_at);
