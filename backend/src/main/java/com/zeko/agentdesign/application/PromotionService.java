package com.zeko.agentdesign.application;

import com.zeko.agentdesign.domain.SkillDefinition;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.application.TraceRecorder;
import com.zeko.traceability.domain.SafeDetail;
import com.zeko.traceability.domain.TraceLink;
import java.time.Instant;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class PromotionService {
    private final AgentRepository agents;
    private final SkillRepository skills;
    private final TraceRecorder traces;

    public PromotionService(AgentRepository agents, SkillRepository skills, TraceRecorder traces) {
        this.agents = agents;
        this.skills = skills;
        this.traces = traces;
    }

    public Promotion promoteTemplate(ResourceId templateId, String decision) {
        agents.findTemplateById(templateId).orElseThrow(() -> DomainError.notFound("AgentTemplate", templateId));
        return record("AGENT_TEMPLATE", templateId, decision);
    }

    public Promotion promoteSkill(ResourceId skillId, String decision) {
        SkillDefinition skill = skills.findById(skillId)
                .orElseThrow(() -> DomainError.notFound("SkillDefinition", skillId));
        return record("SKILL", skill.id(), decision);
    }

    private Promotion record(String sourceType, ResourceId sourceId, String decision) {
        if (!"PROMOTE".equals(decision) && !"REJECT".equals(decision)) {
            throw DomainError.validation("La decision de promocion no es valida");
        }
        ResourceId decisionId = ResourceId.newId();
        traces.record(new TraceLink(
                ResourceId.newId(), sourceType, sourceId, "PROMOTION_DECISION", decisionId,
                "PROMOTE".equals(decision) ? "PROMOTED_TO_GLOBAL" : "GLOBAL_PROMOTION_REJECTED", Instant.now()),
                SafeDetail.of(Map.of("scope", "GLOBAL", "decision", decision)));
        return new Promotion(decisionId.asString(), decision, "GLOBAL");
    }

    public record Promotion(String id, String decision, String scope) {
    }
}
