package com.zeko.sharedkernel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.infrastructure.MigrationLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.sqlite.SQLiteDataSource;

@SpringBootTest
class SqliteBootstrapIntegrationTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("zeko.db").toString());
        registry.add("zeko.datasource.busy-timeout", () -> "5s");
        registry.add("zeko.datasource.max-pool-size", () -> "4");
        registry.add("zeko.datasource.migration-lock-timeout", () -> "30s");
    }

    @Test
    void aplicaLaMigracionInicialSobreSqliteReal() {
        List<String> applied = jdbcTemplate.queryForList(
                "SELECT version FROM flyway_schema_history WHERE success = 1 ORDER BY installed_rank", String.class);

        assertThat(applied).containsExactly("001", "002", "003", "004", "005", "006", "007", "008", "009", "010");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM metadata_bootstrap", Integer.class)).isEqualTo(1);
        assertThat(Files.exists(localDataDir.resolve("zeko.db"))).isTrue();
    }

    @Test
    void usaSqliteLocalYNoUnServidorDeBaseDeDatos() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("SQLite");
            assertThat(connection.getMetaData().getURL()).startsWith("jdbc:sqlite:").doesNotContain("//");
        }
    }

    @Test
    void cadaConexionDelPoolAplicaLosPragmasLocales() throws SQLException {
        for (int attempt = 0; attempt < 8; attempt++) {
            try (Connection connection = dataSource.getConnection()) {
                assertThat(pragma(connection, "foreign_keys")).isEqualTo("1");
                assertThat(pragma(connection, "journal_mode")).isEqualTo("wal");
                assertThat(pragma(connection, "busy_timeout")).isEqualTo("5000");
            }
        }
    }

    @Test
    void aplicaClavesForaneasDeVerdad() {
        jdbcTemplate.execute("CREATE TABLE fk_parent (id TEXT PRIMARY KEY)");
        jdbcTemplate.execute(
                "CREATE TABLE fk_child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES fk_parent(id))");
        jdbcTemplate.update("INSERT INTO fk_parent (id) VALUES ('p1')");

        try {
            jdbcTemplate.update("INSERT INTO fk_child (id, parent_id) VALUES ('c1', 'p1')");

            assertThatThrownBy(
                    () -> jdbcTemplate.update("INSERT INTO fk_child (id, parent_id) VALUES ('c2', 'inexistente')"))
                    .hasMessageContaining("FOREIGN KEY constraint failed");

            assertThatThrownBy(() -> jdbcTemplate.update("DELETE FROM fk_parent WHERE id = 'p1'"))
                    .hasMessageContaining("FOREIGN KEY constraint failed");
        } finally {
            jdbcTemplate.execute("DROP TABLE fk_child");
            jdbcTemplate.execute("DROP TABLE fk_parent");
        }
    }

    @Test
    void respetaLosValoresCerradosDelBootstrap() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO metadata_bootstrap (id, schema_scope, created_at, updated_at, version)"
                        + " VALUES ('x', 'ALCANCE_INVENTADO', 'ahora', 'ahora', 1)"))
                .hasMessageContaining("CHECK constraint failed");
    }

    @Test
    void laMetadataSobreviveAUnaReaperturaDelArchivo() throws SQLException {
        jdbcTemplate.update("UPDATE metadata_bootstrap SET version = version + 1");

        SQLiteDataSource reopened = new SQLiteDataSource();
        reopened.setUrl("jdbc:sqlite:" + localDataDir.resolve("zeko.db"));

        try (Connection connection = reopened.getConnection();
                Statement statement = connection.createStatement()) {
            var result = statement.executeQuery("SELECT version FROM metadata_bootstrap");
            assertThat(result.next()).isTrue();
            assertThat(result.getInt(1)).isEqualTo(2);
        }
    }

    @Test
    void laMigracionSeEjecutaDeFormaExclusivaEntreHilos() throws InterruptedException {
        MigrationLock lock = new MigrationLock(localDataDir.resolve("exclusive.lock"), Duration.ofSeconds(10));
        AtomicInteger concurrentEntries = new AtomicInteger();
        AtomicInteger maxObserved = new AtomicInteger();
        CountDownLatch done = new CountDownLatch(4);
        List<Thread> threads = new ArrayList<>();

        for (int i = 0; i < 4; i++) {
            Thread thread = new Thread(() -> {
                lock.runExclusively(() -> {
                    maxObserved.accumulateAndGet(concurrentEntries.incrementAndGet(), Math::max);
                    sleepQuietly();
                    concurrentEntries.decrementAndGet();
                });
                done.countDown();
            });
            threads.add(thread);
            thread.start();
        }

        assertThat(done.await(20, TimeUnit.SECONDS)).isTrue();
        for (Thread thread : threads) {
            thread.join();
        }
        assertThat(maxObserved.get()).isEqualTo(1);
    }

    @Test
    void unSegundoTitularDelLockRecibeConflictoAcotado() throws InterruptedException {
        Path lockFile = localDataDir.resolve("contended.lock");
        MigrationLock holder = new MigrationLock(lockFile, Duration.ofSeconds(10));
        MigrationLock latecomer = new MigrationLock(lockFile, Duration.ofMillis(200));
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);

        Thread owner = new Thread(() -> holder.runExclusively(() -> {
            held.countDown();
            awaitQuietly(release);
        }));
        owner.start();

        try {
            assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();

            long startedAt = System.nanoTime();
            assertThatThrownBy(() -> latecomer.runExclusively(() -> { }))
                    .isInstanceOf(DomainError.class)
                    .extracting(error -> ((DomainError) error).code())
                    .isEqualTo(DomainError.Code.CONFLICT);
            assertThat(Duration.ofNanos(System.nanoTime() - startedAt)).isLessThan(Duration.ofSeconds(5));
        } finally {
            release.countDown();
            owner.join();
        }
    }

    private static String pragma(Connection connection, String name) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            var result = statement.executeQuery("PRAGMA " + name);
            assertThat(result.next()).isTrue();
            return result.getString(1).toLowerCase(java.util.Locale.ROOT);
        }
    }

    private static void sleepQuietly() {
        try {
            Thread.sleep(60);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    private static void awaitQuietly(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
