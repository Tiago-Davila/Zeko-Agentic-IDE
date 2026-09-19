package com.zeko.memorysearch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.application.MemoryRepository;
import com.zeko.memorysearch.application.MemorySearchService;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.memorysearch.infrastructure.LocalSourceReader;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SecretExposureIntegrationTest {

    @TempDir
    Path localRoot;

    @Test
    void unaFuenteConSecretoNoSeLeeParaIndexarla() throws Exception {
        Path secretSource = localRoot.resolve("notes.txt");
        Files.writeString(secretSource, "token=synthetic-secret");

        assertThatThrownBy(() -> new LocalSourceReader().read(localRoot, secretSource))
                .isInstanceOfSatisfying(DomainError.class,
                        error -> assertThat(error.code()).isEqualTo(DomainError.Code.FORBIDDEN));
    }

    @Test
    void unaEntradaSensibleNoApareceAunqueElIndiceLaDevuelva() {
        ResourceId projectId = ResourceId.newId();
        ResourceId ownerId = ResourceId.newId();
        MemoryEntry sensitive = new MemoryEntry(
                ResourceId.newId(),
                MemoryScope.PROJECT,
                projectId,
                ownerId,
                "notes.txt",
                "fingerprint",
                MemoryEntry.IndexState.CURRENT,
                true);
        ContextIndex index = new FixedIndex(sensitive.id());
        MemoryRepository repository = new FixedRepository(sensitive);

        assertThat(new MemorySearchService(repository, index).search(projectId, ownerId, "secret"))
                .isEmpty();
    }

    private record FixedIndex(ResourceId sourceId) implements ContextIndex {

        @Override
        public void index(MemoryEntry entry, String content) {
        }

        @Override
        public List<Result> search(ResourceId projectId, ResourceId ownerId, String query) {
            return List.of(new Result(sourceId, "PROJECT", "secret omitted"));
        }
    }

    private record FixedRepository(MemoryEntry entry) implements MemoryRepository {

        @Override
        public void save(MemoryEntry entry) {
        }

        @Override
        public Optional<MemoryEntry> find(ResourceId id) {
            return Optional.of(entry).filter(candidate -> candidate.id().equals(id));
        }

        @Override
        public List<MemoryEntry> findForProject(ResourceId projectId) {
            return entry.projectId().equals(projectId) ? List.of(entry) : List.of();
        }
    }
}
