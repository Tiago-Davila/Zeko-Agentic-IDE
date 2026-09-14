package com.zeko.coordination.infrastructure;

import com.zeko.coordination.application.ConversationRepository;
import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.Instruction;
import com.zeko.coordination.domain.InstructionPrecedence;
import com.zeko.sharedkernel.domain.ResourceId;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Repository
public class JdbcConversationRepository implements ConversationRepository {
  private final JdbcTemplate jdbcTemplate;

  public JdbcConversationRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  @Transactional
  public void save(Conversation conversation) {
    jdbcTemplate.update("INSERT INTO conversations (id, project_id, " +
                        "recipient_type, recipient_id) "
                            + "VALUES (?, ?, ?, ?)",
                        conversation.id().asString(),
                        conversation.projectId().asString(),
                        conversation.recipientType().name(),
                        conversation.recipientId().asString());
    conversation.instructions().forEach(this::append);
  }

  @Override
  public void append(Instruction instruction) {
    jdbcTemplate.update(
        "INSERT INTO instructions (id, conversation_id, origin, content, " +
        "precedence, "
            + "override_of, override_scope, related_resource_id, created_at) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        instruction.id().asString(), instruction.conversationId().asString(),
        instruction.origin().name(), instruction.content(),
        instruction.precedence().name(), id(instruction.overrideOf()),
        instruction.overrideScope(), id(instruction.relatedResourceId()),
        instruction.createdAt().toString());
  }

  @Override
  public Optional<Conversation> findById(ResourceId conversationId) {
    return jdbcTemplate
        .query("SELECT id, project_id, recipient_type, recipient_id FROM " +
               "conversations "
                   + "WHERE id = ?",
               (row, index)
                   -> readConversation(row.getString("id"),
                                       row.getString("project_id"),
                                       row.getString("recipient_type"),
                                       row.getString("recipient_id")),
               conversationId.asString())
        .stream()
        .findFirst();
  }

  @Override
  public List<Conversation> findByProjectId(ResourceId projectId) {
    return jdbcTemplate.query(
        "SELECT id, project_id, recipient_type, recipient_id FROM " +
        "conversations "
            + "WHERE project_id = ? ORDER BY created_at, id",
        (row, index)
            -> readConversation(
                row.getString("id"), row.getString("project_id"),
                row.getString("recipient_type"), row.getString("recipient_id")),
        projectId.asString());
  }

  private Conversation readConversation(String id, String projectId,
                                        String recipientType,
                                        String recipientId) {
    ResourceId conversationId = ResourceId.parse(id);
    List<Instruction> instructions = jdbcTemplate.query(
        "SELECT id, conversation_id, origin, content, precedence, "
            + "override_of, override_scope, related_resource_id, created_at " +
              "FROM instructions "
            + "WHERE conversation_id = ? ORDER BY created_at, id",
        (row, index) -> readInstruction(row), conversationId.asString());
    return new Conversation(conversationId, ResourceId.parse(projectId),
                            Conversation.RecipientType.valueOf(recipientType),
                            ResourceId.parse(recipientId), instructions);
  }

  private static Instruction readInstruction(ResultSet row)
      throws SQLException {
    return new Instruction(
        ResourceId.parse(row.getString("id")),
        ResourceId.parse(row.getString("conversation_id")),
        Instruction.Origin.valueOf(row.getString("origin")),
        row.getString("content"),
        InstructionPrecedence.valueOf(row.getString("precedence")),
        resourceId(row.getString("override_of")),
        row.getString("override_scope"),
        resourceId(row.getString("related_resource_id")),
        Instant.parse(row.getString("created_at")));
  }

  private static String id(ResourceId value) {
    return value == null ? null : value.asString();
  }

  private static ResourceId resourceId(String value) {
    return value == null ? null : ResourceId.parse(value);
  }
}
