import { DatabaseSync } from "node:sqlite";
import { configureSqlite, type SqlDriver, type SqliteOptions } from "./sql-driver.js";

export class NodeSqliteDriver implements SqlDriver {
  readonly #database: DatabaseSync;

  constructor(path: string, options: SqliteOptions = {}) {
    this.#database = new DatabaseSync(path, { timeout: options.busyTimeoutMs ?? 5_000 });
    configureSqlite(this.#database, options);
  }

  exec(sql: string): void { this.#database.exec(sql); }
  prepare(sql: string) { return this.#database.prepare(sql); }
  close(): void { this.#database.close(); }

  transaction<T>(work: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }
}
