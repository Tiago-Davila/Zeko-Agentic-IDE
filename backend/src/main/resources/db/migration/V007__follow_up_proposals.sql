CREATE TABLE follow_up_proposals (
    id TEXT NOT NULL PRIMARY KEY,
    instruction_id TEXT NOT NULL REFERENCES instructions(id),
    agent_instance_id TEXT NOT NULL REFERENCES agent_instances(id),
    proposal TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CONSTRAINT follow_up_proposals_state_closed CHECK (state IN ('PENDING_CONFIRMATION', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    CONSTRAINT follow_up_proposals_content_not_blank CHECK (length(trim(proposal)) > 0)
);
CREATE INDEX follow_up_proposals_instruction_id_idx ON follow_up_proposals(instruction_id, state);
