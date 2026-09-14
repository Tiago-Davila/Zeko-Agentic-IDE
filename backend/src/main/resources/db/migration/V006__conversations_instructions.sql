CREATE TABLE conversations (
    id TEXT NOT NULL PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), recipient_type TEXT NOT NULL,
    recipient_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT conversations_recipient_closed CHECK (recipient_type IN ('PM', 'AGENT'))
);
CREATE TABLE instructions (
    id TEXT NOT NULL PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), origin TEXT NOT NULL,
    content TEXT NOT NULL, precedence TEXT NOT NULL, override_of TEXT, override_scope TEXT,
    related_resource_id TEXT, created_at TEXT NOT NULL,
    CONSTRAINT instructions_origin_closed CHECK (origin IN ('USER', 'PROJECT_RULES', 'PROJECT_MANAGER', 'AGENT', 'SKILL', 'DEFAULT')),
    CONSTRAINT instructions_precedence_closed CHECK (precedence IN ('USER', 'PROJECT_RULES', 'PROJECT_MANAGER', 'AGENT', 'SKILL', 'DEFAULT')),
    CONSTRAINT instructions_content_not_blank CHECK (length(trim(content)) > 0)
);
CREATE INDEX conversations_project_id_idx ON conversations(project_id, created_at);
CREATE INDEX instructions_conversation_id_idx ON instructions(conversation_id, created_at);
