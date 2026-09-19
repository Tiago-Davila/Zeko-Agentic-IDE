package com.zeko.projectcatalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.projectcatalog.application.RepositoryInspector.Inspection;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import com.zeko.projectcatalog.infrastructure.GitRepositoryInspector;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GitRepositoryInspectorIntegrationTest {

    @TempDir
    Path temporaryDirectory;

    private final GitRepositoryInspector inspector = new GitRepositoryInspector();

    @Test
    void identifiesAGitRootForARepositoryPathContainingSpaces() throws IOException, InterruptedException {
        Path repository = Files.createDirectory(temporaryDirectory.resolve("repo con espacios"));
        git(repository, "init", "--quiet");

        Inspection inspection = inspector.inspect(repository.resolve("."));

        assertThat(inspection.accessState()).isEqualTo(RepositoryAccessState.AVAILABLE);
        assertThat(inspection.normalizedPath()).isEqualTo(repository.toAbsolutePath().normalize());
        assertThat(inspection.gitRoot()).isEqualTo(repository.toAbsolutePath().normalize());
    }

    @Test
    void distinguishesUnavailableAndNonGitPathsWithoutExecutingACommandForTheMissingPath() throws IOException {
        Path nonGit = Files.createDirectory(temporaryDirectory.resolve("not-git"));

        Inspection invalid = inspector.inspect(nonGit);
        Inspection unavailable = inspector.inspect(temporaryDirectory.resolve("missing"));

        assertThat(invalid.accessState()).isEqualTo(RepositoryAccessState.INVALID);
        assertThat(unavailable.accessState()).isEqualTo(RepositoryAccessState.UNAVAILABLE);
    }

    private static void git(Path directory, String... arguments) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(Arrays.asList(arguments));
        Process process = new ProcessBuilder(command)
                .directory(directory.toFile())
                .redirectErrorStream(true)
                .start();

        assertThat(process.waitFor()).isZero();
    }

}
