import type { SqlDriver } from "./sql-driver.js";
import { applyInitialMigration } from "./migrations/001_initial.js";

const MIGRATIONS = [{ version: 1, apply: applyInitialMigration }] as const;

export function migrate(driver: SqlDriver): number {
  driver.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const versions = driver.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
  const current = versions.at(-1)?.version ?? 0;
  const latest = MIGRATIONS.at(-1)?.version ?? 0;
  if (current > latest) throw new Error(`Database schema ${current} is newer than this application (${latest})`);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    driver.transaction(() => {
      migration.apply(driver);
      driver.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(migration.version, Date.now());
    });
  }
  return latest;
}
