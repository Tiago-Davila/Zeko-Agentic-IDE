import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LaunchSpec } from "@zeko/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { CodexAdapter } from "../../src/codex/adapter.ts";

const directories: string[] = [];
const fakeAgent = fileURLToPath(new URL("../fake-agent/main.ts", import.meta.url));
const baseSpec = (workspacePath: string): LaunchSpec => ({
  agentId: "codex", runId: "018f0000-0000-7000-8000-000000000001", nodeRunId: "018f0000-0000-7000-8000-000000000002", attemptId: "018f0000-0000-7000-8000-000000000003",
  workspacePath, model: { model: "gpt-5.4-mini", reasoningEffort: "low" }, prompt: "Return a report", reportSchema: { type: "object", properties: {}, required: [], additionalProperties: false }, writeScope: [], terminal: { enabled: false, allowedCommands: [] }, platform: process.platform === "win32" ? "win32" : "linux",
});

afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("CodexAdapter.launch", () => {
  it("replays Codex JSONL through the supervised process and resolves the final outcome", async () => {
    const directory = await temporaryDirectory();
    const scenario = await scenarioFile(directory, { mode: "replay", fixture: "codex/events/thread.started.json" });
    const adapter = replayAdapter(scenario);
    try {
      const execution = adapter.launch(baseSpec(directory));
      const observed = [];
      for await (const event of execution.events) observed.push(event);
      const result = await execution.completion;
      expect(execution.rootPid.pid).toBeGreaterThan(0);
      expect(observed).toContainEqual(expect.objectContaining({ type: "session_started", sessionId: "01a0d5ca-ac8f-7560-8217-1bde16a7a037" }));
      expect(result.outcome.kind).toBe("crashed");
      expect(result.report).toEqual({ state: "absent" });
    } finally { await adapter.dispose(); }
  }, 20_000);

  it("classifies an exit-zero 267 signature as infrastructure failure", async () => {
    const directory = await temporaryDirectory();
    const scenario = await scenarioFile(directory, { mode: "replay", fixture: "codex/events/turn.completed.json", stderrLines: ["CreateProcessWithLogonW failed: 267"], exitCode: 0 });
    const adapter = replayAdapter(scenario);
    try {
      const result = await adapter.launch(baseSpec(directory)).completion;
      expect(result.outcome).toMatchObject({ kind: "infra_failure", cause: "process_create" });
    } finally { await adapter.dispose(); }
  }, 20_000);

  it("requires an injected native executable when ZEKO_TEST is enabled", () => {
    const previous = process.env["ZEKO_TEST"];
    process.env["ZEKO_TEST"] = "1";
    try { expect(() => new CodexAdapter().launch(baseSpec(process.cwd()))).toThrow("CODEX_BINARY_NOT_INJECTED"); }
    finally { if (previous === undefined) delete process.env["ZEKO_TEST"]; else process.env["ZEKO_TEST"] = previous; }
  });
});

function replayAdapter(scenario: string): CodexAdapter {
  return new CodexAdapter({ binaryPath: process.execPath, prefixArgs: ["--experimental-strip-types", fakeAgent, scenario], codexHome: join(tmpdir(), "zeko-no-codex-home") });
}
async function scenarioFile(directory: string, value: Record<string, unknown>): Promise<string> { const path = join(directory, "scenario.json"); await writeFile(path, JSON.stringify(value)); return path; }
async function temporaryDirectory(): Promise<string> { const directory = await mkdtemp(join(tmpdir(), "zeko-codex-adapter-")); directories.push(directory); return directory; }
