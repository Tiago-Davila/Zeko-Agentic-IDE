package com.zeko.agentdesign.api;

import com.zeko.agentdesign.application.PromotionService;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PromotionController {
    private final PromotionService promotions;
    public PromotionController(PromotionService promotions) {
        this.promotions = promotions;
    }
    @PostMapping("/agent-templates/{templateId}/global-promotions")
    public ResponseEntity<PromotionService.Promotion> template(
            @PathVariable String templateId, @RequestBody PromotionInput input) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(promotions.promoteTemplate(ResourceId.parse(templateId), input.decision()));
    }
    @PostMapping("/skills/{skillId}/global-promotions")
    public ResponseEntity<PromotionService.Promotion> skill(
            @PathVariable String skillId, @RequestBody PromotionInput input) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(promotions.promoteSkill(ResourceId.parse(skillId), input.decision()));
    }
    public record PromotionInput(String decision, String scope) {
    }
}
