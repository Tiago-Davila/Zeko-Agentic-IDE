import type { DatabaseSync, StatementSync } from "node:sqlite";

export interface SqlDriver {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  transaction<T>(work: () => T): T;
  close(): void;
}

export interface SqliteOptions {
  busyTimeoutMs?: number;
}

export function configureSqlite(database: DatabaseSync, options: SqliteOptions = {}): void {
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = FULL");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(options.busyTimeoutMs ?? 5_000))}`);
}
