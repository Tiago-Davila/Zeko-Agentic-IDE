package com.zeko.coordination.infrastructure;

import com.zeko.coordination.application.FollowUpRepository;
import com.zeko.coordination.domain.FollowUpProposal;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;

@org.springframework.stereotype.Repository
public class JdbcFollowUpRepository implements FollowUpRepository {
  private final JdbcTemplate jdbcTemplate;

  public JdbcFollowUpRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public void save(FollowUpProposal proposal) {
    int updated =
        jdbcTemplate.update("UPDATE follow_up_proposals SET state = ? WHERE " +
                            "id = ? AND state = 'PENDING_CONFIRMATION'",
                            proposal.state().name(), proposal.id().asString());
    if (updated == 0 &&
        proposal.state() == FollowUpProposal.State.PENDING_CONFIRMATION) {
      jdbcTemplate.update(
          "INSERT INTO follow_up_proposals (id, instruction_id, " +
          "agent_instance_id, proposal, state, created_at) "
              + "VALUES (?, ?, ?, ?, ?, ?)",
          proposal.id().asString(), proposal.instructionId().asString(),
          proposal.agentInstanceId().asString(), proposal.proposal(),
          proposal.state().name(), proposal.createdAt().toString());
    } else if (updated == 0) {
      throw DomainError.conflict(
          "La confirmacion de follow-up ya fue registrada");
    }
  }

  @Override
  public Optional<FollowUpProposal> findById(ResourceId proposalId) {
    return jdbcTemplate
        .query("SELECT id, instruction_id, agent_instance_id, proposal, " +
               "state, created_at "
                   + "FROM follow_up_proposals WHERE id = ?",
               (row, index)
                   -> new FollowUpProposal(
                       ResourceId.parse(row.getString("id")),
                       ResourceId.parse(row.getString("instruction_id")),
                       ResourceId.parse(row.getString("agent_instance_id")),
                       row.getString("proposal"),
                       FollowUpProposal.State.valueOf(row.getString("state")),
                       Instant.parse(row.getString("created_at"))),
               proposalId.asString())
        .stream()
        .findFirst();
  }
}
