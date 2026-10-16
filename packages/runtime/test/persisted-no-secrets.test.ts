import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectConfigSchema } from "@zeko/contracts";
import type { AgentAdapter, NormalizedEvent } from "@zeko/contracts";
import { CLAUDE_LIKE_CAPABILITIES, ControllableClock, InMemoryWorkspacePort, ScriptedAdapter } from "@zeko/testing";
import { afterEach, describe, expect, it } from "vitest";
import { NodeSqliteDriver, createRedactor, migrate, RunsRepository, SqliteSlotLeases, RawLogWriter } from "@zeko/storage";
import { RunEngine } from "@zeko/core";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("persisted secret redaction", () => {
  it("runs the leaks-secret scenario and keeps credentials out of all SQLite and JSONL records", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeko-no-secrets-")); dirs.push(dir);
    const db = new NodeSqliteDriver(join(dir, "zeko.db")); migrate(db);
    const redactor = createRedactor();
    const injected = "synthetic-injected-credential";
    const store = new RunsRepository(db, redactor, Date.now, new RawLogWriter(join(dir, "logs")));
    const clock = new ControllableClock("2026-01-01T00:00:00.000Z");
    let serial = 1;
    const attemptId = "018f0000-0000-7000-8000-000000000100";
    const common = { ts: clock.now(), attemptId };
    const events: NormalizedEvent[] = [
      { ...common, type: "assistant_text", text: `key ${injected} sk-ant-abcdefghijklmnop Authorization: Bearer bearer-secret-123 agent@example.com eyJabcdefgh.abcdefgh.abcdefgh` },
      { ...common, type: "stderr", line: `stderr ${injected} person@example.org` },
      { ...common, type: "tool_result", ok: false, content: `tool ${injected} Authorization: Bearer result-token` },
      { ...common, type: "raw", data: { error: `error ${injected} sk-abcdefghijklmnop` } },
      { ...common, type: "inferred_denial", source: "agent_policy", message: `blocked for person@example.net ${injected}` },
    ];
    const scripted = new ScriptedAdapter({ capabilities: CLAUDE_LIKE_CAPABILITIES, executions: [{
      events, sensitiveValues: [injected], outcome: { kind: "agent_error", exitCode: 1, durationMs: 8, errors: [`failure ${injected} Authorization: Bearer process-token`], terminalReason: "agent@example.com" },
    }] });
    const adapter: AgentAdapter = {
      id: "claude-code",
      capabilities: (platform) => scripted.capabilities(platform),
      detect: () => scripted.detect(),
      readUsage: () => scripted.readUsage(),
      launch: (spec) => scripted.launch(spec),
      requestReport: (previous, spec) => scripted.requestReport(previous, spec),
    };
    const flow = {
      schemaVersion: 1 as const, id: "leaks-secret", name: "Leak test",
      nodes: [
        { id: "goal", type: "input" as const, position: { x: 0, y: 0 }, objective: "exercise redaction" },
        { id: "agent", type: "agent" as const, position: { x: 1, y: 0 }, agent: "claude-code" as const,
          models: { "claude-code": { model: "sonnet" } }, instructions: "test", acceptanceCriteria: [], writeScope: [],
          terminal: { enabled: false, allowedCommands: [] }, limits: { timeoutMinutes: 1, maxTurns: 2, maxRetries: 0 } },
      ], edges: [{ from: "goal", to: "agent" }],
    };
    const engine = new RunEngine({ flow, projectConfig: ProjectConfigSchema.parse({}), adapters: { "claude-code": adapter },
      workspace: new InMemoryWorkspacePort(), store,
      slots: new SqliteSlotLeases(db, { hostPid: process.pid, hostStartedAt: Date.now() - process.uptime() * 1_000 }),
      clock, projectRoot: "C:/repo", flowFile: "leaks-secret.yaml", flowHash: "hash", baseCommit: "head",
      platform: "linux", hostPid: process.pid, hostStartedAt: clock.now(), enforceTimeouts: false,
      createId: () => `018f0000-0000-7000-8000-${(serial++).toString(16).padStart(12, "0")}`,
    });

    const result = await engine.execute();
    expect(result.nodeRuns.get("agent")?.attempts).toHaveLength(1);
    expect(db.prepare("SELECT type,attempt_id FROM events").all()).toContainEqual(expect.objectContaining({ type: "agent.text" }));
    await store.events.flush();
    const persisted = [
      ...db.prepare("SELECT * FROM events").all(),
      ...db.prepare("SELECT * FROM node_runs").all(),
      ...db.prepare("SELECT * FROM attempts").all(),
    ].map((row) => JSON.stringify(row)).join("\n");
    const rawRoot = join(dir, "logs", result.run.id);
    const rawLogs = readdirSync(rawRoot).map((file) => readFileSync(join(rawRoot, file), "utf8")).join("\n");
    const allStored = `${persisted}\n${rawLogs}`;
    for (const secret of [injected, "sk-ant-abcdefghijklmnop", "bearer-secret-123", "agent@example.com", "person@example.org", "person@example.net", "process-token", "result-token", "eyJabcdefgh.abcdefgh.abcdefgh"]) {
      expect(allStored).not.toContain(secret);
    }
    expect(allStored).toContain("[REDACTED:api_key]");
    expect(allStored).toContain("[REDACTED:email]");
    expect(allStored).toContain("[REDACTED:bearer_token]");
    expect(allStored).toContain("[REDACTED:jwt]");
    expect(db.prepare("SELECT COUNT(*) AS count FROM attempts").get()).toMatchObject({ count: 1 });
    db.close();
  }, 15_000);
});
