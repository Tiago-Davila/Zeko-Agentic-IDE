import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../../src/migrate.js";
import { NodeSqliteDriver } from "../../src/node-sqlite-driver.js";
import { AgentUsageRepository } from "../../src/repos/agent-usage.js";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("agent usage repository", () => {
  it("round-trips latest windows and replaces stale readings", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeko-usage-")); dirs.push(dir);
    const db = new NodeSqliteDriver(join(dir, "db.sqlite")); migrate(db);
    const repo = new AgentUsageRepository(db);
    await repo.write({ agentId: "claude-code", authMode: "subscription", windows: [{ name: "weekly", utilization: 0.4 }], readAt: "2026-01-01T00:00:00.000Z", live: true, source: "test" });
    await repo.write({ agentId: "claude-code", authMode: "subscription", windows: [
      { name: "weekly", utilization: 0.7, resetsAt: "2026-01-08T00:00:00.000Z" }, { name: "session", utilization: 0.2 },
    ], readAt: "2026-01-02T00:00:00.000Z", live: false, source: "cache" });
    expect(await repo.readLatest("claude-code", "subscription")).toEqual({
      agentId: "claude-code", authMode: "subscription", windows: [
        { name: "session", utilization: 0.2 }, { name: "weekly", utilization: 0.7, resetsAt: "2026-01-08T00:00:00.000Z" },
      ], readAt: "2026-01-02T00:00:00.000Z", live: false, source: "cache",
    });
    expect(await repo.readLatest("codex", "detect")).toBeUndefined();
    db.close();
  });
});
