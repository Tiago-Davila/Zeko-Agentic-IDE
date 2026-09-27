import { describe, expect, it } from "vitest";
import type { LaunchSpec, NormalizedEvent } from "@zeko/contracts";
import { CLAUDE_LIKE_CAPABILITIES, CODEX_LIKE_CAPABILITIES } from "../src/capability-profiles.js";
import { ControllableClock, InMemorySlotLeasePort, InMemoryUsageStore, InMemoryWorkspacePort } from "../src/in-memory-ports.js";
import { ScriptedAdapter } from "../src/scripted-adapter.js";

const attemptId = "018f0000-0000-7000-8000-000000000101";
const event: NormalizedEvent = { type: "assistant_text", ts: "2026-09-25T00:00:00.000Z", attemptId, text: "scripted" };
const launchSpec: LaunchSpec = {
  agentId: "fake", runId: "018f0000-0000-7000-8000-000000000102",
  nodeRunId: "018f0000-0000-7000-8000-000000000103", attemptId,
  workspacePath: "/memory/work", model: { model: "test-model" }, prompt: "test",
  reportSchema: {}, writeScope: [], terminal: { enabled: false, allowedCommands: [] }, platform: "linux",
};

describe("ScriptedAdapter", () => {
  it("plays deterministic events and completion, then records a report request", async () => {
    const adapter = new ScriptedAdapter({
      capabilities: CLAUDE_LIKE_CAPABILITIES,
      executions: [
        { events: [event], outcome: { kind: "exited", exitCode: 0, durationMs: 7 }, report: { state: "absent" } },
        { report: { state: "absent" } },
      ],
    });
    const first = adapter.launch(launchSpec);
    const events: NormalizedEvent[] = [];
    for await (const item of first.events) events.push(item);
    expect(events).toEqual([event]);
    expect(await first.completion).toEqual({ outcome: { kind: "exited", exitCode: 0, durationMs: 7 }, report: { state: "absent" } });
    const second = adapter.requestReport(first, launchSpec);
    expect((await second.completion).report).toEqual({ state: "absent" });
    expect(adapter.launches.map(({ kind }) => kind)).toEqual(["launch", "requestReport"]);
  });

  it("exposes configurable platform capabilities and records cancellation", async () => {
    const adapter = new ScriptedAdapter({ id: "codex", capabilities: CODEX_LIKE_CAPABILITIES });
    expect(adapter.capabilities("win32").terminal.canDisable).toBe(false);
    expect(adapter.capabilities("linux").processTree).toBe("process_group");
    const execution = adapter.launch({ ...launchSpec, agentId: "codex", model: { model: "gpt-test", reasoningEffort: "medium" } });
    await execution.cancel("timeout");
    expect(adapter.cancellations).toEqual([{ execution, reason: "timeout" }]);
  });
});

describe("in-memory ports", () => {
  it("tracks workspace lifecycle, slot limits and controllable time", async () => {
    const workspace = new InMemoryWorkspacePort();
    const created = await workspace.create({ runId: "run", nodeId: "node", baseCommit: "head" });
    expect(workspace.workspaces.has(created.path)).toBe(true);
    await workspace.remove(created.path);
    expect(workspace.workspaces.has(created.path)).toBe(false);

    const slots = new InMemorySlotLeasePort();
    expect(await slots.acquire("project", "one", 1)).toBe(true);
    expect(await slots.acquire("project", "two", 1)).toBe(false);
    await slots.heartbeat("one");
    expect(slots.leases.get("one")?.heartbeatCount).toBe(1);
    await slots.release("one");
    expect(await slots.acquire("project", "two", 1)).toBe(true);

    const clock = new ControllableClock("2026-01-01T00:00:00.000Z");
    await clock.sleep(250);
    expect(clock.now()).toBe("2026-01-01T00:00:00.250Z");
    expect(clock.sleeps).toEqual([250]);
  });

  it("stores and returns usage readings without sharing mutable objects", async () => {
    const usage = new InMemoryUsageStore();
    const reading = { agentId: "fake" as const, authMode: "detect" as const, windows: [], readAt: "2026-01-01T00:00:00.000Z", live: false, source: "test" };
    await usage.write(reading);
    const readback = await usage.readLatest("fake", "detect");
    expect(readback).toEqual(reading);
    expect(readback).not.toBe(reading);
  });
});
