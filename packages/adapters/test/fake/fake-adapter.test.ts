import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentCapabilities, LaunchSpec, Platform } from "@zeko/contracts";
import { FakeAdapter } from "../../src/fake/fake-adapter.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("FakeAdapter", () => {
  it("runs fake-agent in native mode through the supervisor and exposes configured capabilities", async () => {
    const { directory, scenario } = await createScenario({
      events: [{ type: "assistant_text", ts: "2026-09-26T00:00:00.000Z", attemptId: "018f0000-0000-7000-8000-000000000101", text: "native fake" }],
      outcome: { kind: "exited", exitCode: 0, durationMs: 12 },
      reportCandidate: { state: "valid", report: { status: "COMPLETED", summary: "Done", filesChanged: [], checks: [], blockers: [], findings: [] } },
    });
    const configured: AgentCapabilities = {
      ...defaultCapabilities("win32"),
      orderlyInterrupt: false,
      reportsDenials: false,
    };
    const adapter = new FakeAdapter({ scenarioPath: scenario, capabilities: { win32: configured } });
    try {
      expect(adapter.capabilities("win32").orderlyInterrupt).toBe(false);
      expect(adapter.capabilities("win32").reportsDenials).toBe(false);
      const execution = adapter.launch(launchSpec(directory));
      const events = await collect(execution.events);
      const result = await execution.completion;
      expect(result).toMatchObject({ outcome: { kind: "exited", exitCode: 0 }, report: { state: "valid" } });
      expect(events).toContainEqual(expect.objectContaining({ type: "assistant_text", text: "native fake", attemptId: "018f0000-0000-7000-8000-000000000103" }));
      expect(execution.rootPid.pid).toBeGreaterThan(0);
      expect(execution.rootPid.creationTime).toBeGreaterThan(0);
    } finally {
      await adapter.dispose();
    }
  });

  it("uses the orderly interrupt first when configured to support it", async () => {
    const { directory, scenario } = await createScenario({ hangUntilInterrupt: true, interruptMode: "respond" });
    const adapter = new FakeAdapter({ scenarioPath: scenario, interruptGraceMs: 500 });
    try {
      const execution = adapter.launch(launchSpec(directory));
      const events = execution.events[Symbol.asyncIterator]();
      await events.next();
      await execution.cancel("user");
      await expect(execution.completion).resolves.toMatchObject({ outcome: { kind: "killed", by: "user", phase: "interrupt" } });
    } finally {
      await adapter.dispose();
    }
  });

  it("terminates the registered process tree when orderly interrupt is unavailable", async () => {
    const { directory, scenario } = await createScenario({ hangUntilInterrupt: true, interruptMode: "ignore" });
    const platform = process.platform === "win32" ? "win32" : "linux";
    const adapter = new FakeAdapter({
      scenarioPath: scenario,
      capabilities: { [platform]: { ...defaultCapabilities(platform), orderlyInterrupt: false } },
    });
    try {
      const execution = adapter.launch(launchSpec(directory));
      await execution.events[Symbol.asyncIterator]().next();
      await execution.cancel("timeout");
      await expect(execution.completion).resolves.toMatchObject({ outcome: { kind: "killed", by: "timeout", phase: "tree_kill" } });
    } finally {
      await adapter.dispose();
    }
  }, 15_000);
});

async function createScenario(value: Record<string, unknown>): Promise<{ directory: string; scenario: string }> {
  const directory = await mkdtemp(join(tmpdir(), "zeko-fake-adapter-"));
  temporaryDirectories.push(directory);
  const scenario = join(directory, "scenario.json");
  await writeFile(scenario, JSON.stringify(value), "utf8");
  return { directory, scenario };
}

function launchSpec(workspacePath: string): LaunchSpec {
  return {
    agentId: "fake",
    runId: "018f0000-0000-7000-8000-000000000101",
    nodeRunId: "018f0000-0000-7000-8000-000000000102",
    attemptId: "018f0000-0000-7000-8000-000000000103",
    workspacePath,
    model: { model: "fake-model" },
    prompt: "test prompt",
    reportSchema: {},
    writeScope: ["**"],
    terminal: { enabled: false, allowedCommands: [] },
    platform: process.platform === "win32" ? "win32" : "linux",
  };
}

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const value of values) collected.push(value);
  return collected;
}

function defaultCapabilities(platform: Platform): AgentCapabilities {
  return {
    terminal: { canDisable: true },
    confinement: { noTerminal: "full", withTerminal: "write_only" },
    writeScopeEnforcement: { unrestricted: "prevent", partial: "prevent" },
    commandAllowlist: { supported: true, shell: platform === "win32" ? "PowerShell" : "Bash", readonlyAutoApproved: false },
    reportsDenials: true,
    infersDenials: false,
    supportsTurnLimit: true,
    timeLimit: "engine",
    orderlyInterrupt: true,
    network: "none",
    structuredOutput: true,
    reportRequest: "exec_fork",
    explicitModel: true,
    reportsCost: true,
    reportsConsumption: true,
    subscriptionUsage: "live",
    authModes: [{ mode: "detect", verified: true }],
    infraFailureClasses: [],
    processTree: platform === "win32" ? "windows_process_tree" : "process_group",
  };
}
