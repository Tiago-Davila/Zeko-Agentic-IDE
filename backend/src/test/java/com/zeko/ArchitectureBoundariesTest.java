package com.zeko;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class ArchitectureBoundariesTest {

    private static final String ROOT_PACKAGE = "com.zeko";

    private static final Pattern IMPORT_LINE =
            Pattern.compile("^\\s*import\\s+(?:static\\s+)?([\\p{L}0-9_.]+)\\s*;");

    private static final Set<String> LAYERS = Set.of("domain", "application", "infrastructure", "api");

    private static final Map<String, Set<String>> ALLOWED_MODULE_DEPENDENCIES = Map.of(
            "sharedkernel", Set.of(),
            "traceability", Set.of("sharedkernel"),
            "projectcatalog", Set.of("sharedkernel", "traceability"),
            "agentdesign", Set.of("sharedkernel", "traceability", "projectcatalog"),
            "coordination", Set.of("sharedkernel", "traceability", "agentdesign"),
            "executioncontrol", Set.of("sharedkernel", "traceability", "projectcatalog", "agentdesign"),
            "memorysearch", Set.of("sharedkernel", "projectcatalog", "agentdesign", "coordination"));

    private static final Map<String, Set<String>> ALLOWED_LAYER_DEPENDENCIES = Map.of(
            "domain", Set.of("domain"),
            "application", Set.of("domain", "application"),
            "infrastructure", Set.of("domain", "application", "infrastructure"),
            "api", Set.of("domain", "application", "api"));

    @Test
    void everyProductionPackageBelongsToADeclaredModule() {
        List<String> unknown = productionTypes().stream()
                .map(JavaType::module)
                .distinct()
                .filter(module -> !ALLOWED_MODULE_DEPENDENCIES.containsKey(module))
                .toList();

        assertThat(unknown)
                .as("paquetes de primer nivel bajo %s sin modulo declarado en el plan", ROOT_PACKAGE)
                .isEmpty();
    }

    @Test
    void everyProductionTypeBelongsToADeclaredLayer() {
        List<String> unknown = productionTypes().stream()
                .filter(type -> !LAYERS.contains(type.layer()))
                .map(type -> type.module() + "/" + type.layer())
                .distinct()
                .toList();

        assertThat(unknown)
                .as("cada modulo separa domain, application, infrastructure y api")
                .isEmpty();
    }

    @Test
    void modulesOnlyDependOnAllowedModules() {
        assertThat(moduleViolations(productionTypes()))
                .as("dependencias entre modulos fuera del mapa aprobado")
                .isEmpty();
    }

    @Test
    void layersOnlyDependOnAllowedLayers() {
        assertThat(layerViolations(productionTypes()))
                .as("dependencias entre capas fuera del orden aprobado")
                .isEmpty();
    }

    @Test
    void declaredModuleGraphHasNoCycles() {
        assertThat(cyclicModules(ALLOWED_MODULE_DEPENDENCIES))
                .as("el mapa de modulos no admite ciclos")
                .isEmpty();
    }

    @Test
    void detectsForbiddenModuleDependency() {
        JavaType offender = parse(
                Path.of("traceability", "domain", "Offender.java"),
                "package com.zeko.traceability.domain;\nimport com.zeko.executioncontrol.domain.Task;\n");

        assertThat(moduleViolations(List.of(offender)))
                .singleElement()
                .asString()
                .contains("traceability")
                .contains("executioncontrol");
    }

    @Test
    void detectsForbiddenLayerDependency() {
        JavaType offender = parse(
                Path.of("sharedkernel", "domain", "Offender.java"),
                "package com.zeko.sharedkernel.domain;\nimport com.zeko.sharedkernel.infrastructure.Adapter;\n");

        assertThat(layerViolations(List.of(offender)))
                .singleElement()
                .asString()
                .contains("domain")
                .contains("infrastructure");
    }

    @Test
    void acceptsAllowedDependencies() {
        JavaType allowed = parse(
                Path.of("agentdesign", "application", "UseCase.java"),
                "package com.zeko.agentdesign.application;\n"
                        + "import com.zeko.projectcatalog.domain.Repository;\n"
                        + "import java.util.List;\n");

        assertThat(moduleViolations(List.of(allowed))).isEmpty();
        assertThat(layerViolations(List.of(allowed))).isEmpty();
    }

    private static List<String> moduleViolations(List<JavaType> types) {
        List<String> violations = new ArrayList<>();
        for (JavaType type : types) {
            Set<String> allowed = ALLOWED_MODULE_DEPENDENCIES.getOrDefault(type.module(), Set.of());
            for (String imported : type.internalImports()) {
                String target = segment(imported, 0);
                if (!target.equals(type.module()) && !allowed.contains(target)) {
                    violations.add(type.location() + " -> " + target + " (modulo no permitido)");
                }
            }
        }
        return violations;
    }

    private static List<String> layerViolations(List<JavaType> types) {
        List<String> violations = new ArrayList<>();
        for (JavaType type : types) {
            Set<String> allowed = ALLOWED_LAYER_DEPENDENCIES.getOrDefault(type.layer(), Set.of());
            for (String imported : type.internalImports()) {
                String targetLayer = segment(imported, 1);
                if (LAYERS.contains(targetLayer) && !allowed.contains(targetLayer)) {
                    violations.add(type.location() + " (" + type.layer() + ") -> " + targetLayer);
                }
            }
        }
        return violations;
    }

    private static List<String> cyclicModules(Map<String, Set<String>> graph) {
        Set<String> settled = new HashSet<>();
        List<String> cyclic = new ArrayList<>();
        for (String module : graph.keySet()) {
            Deque<String> pending = new ArrayDeque<>(List.of(module));
            Set<String> reachable = new HashSet<>();
            while (!pending.isEmpty()) {
                String current = pending.pop();
                for (String next : graph.getOrDefault(current, Set.of())) {
                    if (reachable.add(next)) {
                        pending.push(next);
                    }
                }
            }
            if (reachable.contains(module) && settled.add(module)) {
                cyclic.add(module);
            }
        }
        return cyclic;
    }

    private static String segment(String qualifiedName, int index) {
        String[] parts = qualifiedName.substring(ROOT_PACKAGE.length() + 1).split("\\.");
        return index < parts.length ? parts[index] : "";
    }

    private static JavaType parse(Path relativePath, String content) {
        List<String> internal = content.lines()
                .map(IMPORT_LINE::matcher)
                .filter(Matcher::find)
                .map(matcher -> matcher.group(1))
                .filter(name -> name.startsWith(ROOT_PACKAGE + "."))
                .toList();

        int depth = relativePath.getNameCount();
        String module = depth > 1 ? relativePath.getName(0).toString() : "";
        String layer = depth > 2 ? relativePath.getName(1).toString() : "";
        return new JavaType(relativePath.toString().replace('\\', '/'), module, layer, internal);
    }

    private static List<JavaType> productionTypes() {
        Path root = sourceRoot();
        try (Stream<Path> files = Files.walk(root)) {
            return files.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .map(path -> parse(root.relativize(path), read(path)))
                    .filter(type -> !type.module().isEmpty())
                    .toList();
        } catch (IOException error) {
            throw new UncheckedIOException(error);
        }
    }

    private static String read(Path path) {
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException error) {
            throw new UncheckedIOException(error);
        }
    }

    private static Path sourceRoot() {
        Path fromModule = Path.of("src", "main", "java", "com", "zeko");
        if (Files.isDirectory(fromModule)) {
            return fromModule;
        }
        Path fromRepository = Path.of("backend", "src", "main", "java", "com", "zeko");
        if (Files.isDirectory(fromRepository)) {
            return fromRepository;
        }
        throw new IllegalStateException("No se encontro el arbol de fuentes de " + ROOT_PACKAGE);
    }

    private record JavaType(String location, String module, String layer, List<String> internalImports) {
    }
}
