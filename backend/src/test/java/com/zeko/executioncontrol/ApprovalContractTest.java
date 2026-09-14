package com.zeko.executioncontrol;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.executioncontrol.application.ApprovalRepository;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.sharedkernel.api.LocalSessionFilter;
import com.zeko.sharedkernel.domain.ResourceId;
import jakarta.servlet.http.Cookie;
import java.nio.file.Path;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApprovalContractTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApprovalRepository approvals;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("approval-api.db").toString());
    }

    @Test
    void returnsSafeActionContextAndRejectsStaleDecision() throws Exception {
        ActionProposal action = new ActionProposal(ResourceId.newId(), ResourceId.newId(), "WRITE_LOCAL",
                "src/App.java", "worktree", Set.of("write file"), 1);
        approvals.saveAction(action);
        Approval pending = Approval.pending(action.id(), 1);
        approvals.saveApproval(pending);
        Cookie session = session();

        mockMvc.perform(get("/api/approvals/" + pending.id()).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionRevision").value(1))
                .andExpect(jsonPath("$.resource").value("src/App.java"))
                .andExpect(jsonPath("$.scope").value("worktree"));
        mockMvc.perform(post("/api/approvals/" + pending.id() + "/decisions").cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actionRevision\":2,\"decision\":\"APPROVE\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void doesNotExposeUnknownApproval() throws Exception {
        mockMvc.perform(get("/api/approvals/00000000-0000-0000-0000-000000000001").cookie(session()))
                .andExpect(status().isNotFound());
    }

    private Cookie session() throws Exception {
        return mockMvc.perform(post("/api/session/bootstrap"))
                .andReturn().getResponse().getCookie(LocalSessionFilter.COOKIE_NAME);
    }
}
