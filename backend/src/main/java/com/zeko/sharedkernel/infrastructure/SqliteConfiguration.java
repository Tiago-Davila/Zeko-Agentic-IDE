package com.zeko.sharedkernel.infrastructure;

import com.zaxxer.hikari.HikariDataSource;
import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteDataSource;

@Configuration
@EnableConfigurationProperties(SqliteConfiguration.SqliteProperties.class)
public class SqliteConfiguration {

    @ConfigurationProperties("zeko.datasource")
    public record SqliteProperties(
            Path path,
            Duration busyTimeout,
            int maxPoolSize,
            Duration migrationLockTimeout) {

        public SqliteProperties {
            if (path == null) {
                throw DomainError.validation("zeko.datasource.path es obligatorio");
            }
            if (busyTimeout == null || busyTimeout.isNegative() || busyTimeout.isZero()) {
                throw DomainError.validation("zeko.datasource.busy-timeout debe ser positivo");
            }
            if (maxPoolSize < 1) {
                throw DomainError.validation("zeko.datasource.max-pool-size debe ser al menos 1");
            }
            if (migrationLockTimeout == null || migrationLockTimeout.isNegative()) {
                throw DomainError.validation("zeko.datasource.migration-lock-timeout debe ser positivo");
            }
        }

        public Path absolutePath() {
            return path.toAbsolutePath().normalize();
        }
    }

    @Bean
    public MigrationLock migrationLock(SqliteProperties properties) {
        Path database = properties.absolutePath();
        Path lockFile = database.resolveSibling(database.getFileName() + ".migration.lock");
        return new MigrationLock(lockFile, properties.migrationLockTimeout());
    }

    // Las migraciones son exclusivas entre procesos locales; no se ejecutan en paralelo.
    @Bean
    public FlywayMigrationStrategy exclusiveMigrationStrategy(MigrationLock migrationLock) {
        return flyway -> migrationLock.runExclusively(flyway::migrate);
    }

    @Bean(destroyMethod = "close")
    public DataSource dataSource(SqliteProperties properties) {
        Path database = properties.absolutePath();
        createDatabaseDirectory(database);

        SQLiteDataSource sqlite = new SQLiteDataSource(localConfig(properties));
        sqlite.setUrl("jdbc:sqlite:" + database);

        HikariDataSource pool = new HikariDataSource();
        pool.setPoolName("zeko-sqlite");
        pool.setDataSource(sqlite);
        pool.setMaximumPoolSize(properties.maxPoolSize());
        pool.setAutoCommit(true);
        return pool;
    }

    private static SQLiteConfig localConfig(SqliteProperties properties) {
        SQLiteConfig config = new SQLiteConfig();
        config.enforceForeignKeys(true);
        config.setJournalMode(SQLiteConfig.JournalMode.WAL);
        config.setSynchronous(SQLiteConfig.SynchronousMode.NORMAL);
        config.setBusyTimeout(Math.toIntExact(properties.busyTimeout().toMillis()));
        return config;
    }

    private static void createDatabaseDirectory(Path database) {
        Path parent = database.getParent();
        if (parent == null) {
            return;
        }

        try {
            Files.createDirectories(parent);
        } catch (IOException failure) {
            throw DomainError.pathInvalid("No se pudo crear el directorio local de la base: " + parent);
        }
    }
}
