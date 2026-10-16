import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CodexExecParser } from "../../src/codex/parser.ts";

const attemptId = "018f0000-0000-7000-8000-000000000003";
const fixture = (name: string): string => readFileSync(new URL(`../fixtures/codex/events/${name}`, import.meta.url), "utf8");
const parser = () => new CodexExecParser({ attemptId, now: () => new Date("2026-09-26T12:00:00.000Z") });

describe("Codex exec --json parser", () => {
  it("maps thread.started to a session with the thread id", () => {
    expect(parser().parse(fixture("thread.started.json"))[0]).toMatchObject({ type: "session_started", sessionId: "01a0d5ca-ac8f-7560-8217-1bde16a7a037", attemptId });
  });

  it("emits completed agent messages as assistant text", () => {
    expect(parser().parse(fixture("item.completed.agent_message.json"))[0]).toMatchObject({ type: "assistant_text", text: "hola" });
  });

  it.each([
    ["command_execution", "item.started.command_execution.in_progress.json", "item.completed.command_execution.failed.json", false],
    ["file_change", "item.started.file_change.in_progress.json", "item.completed.file_change.completed.json", true],
    ["mcp_tool_call", "item.started.mcp_tool_call.in_progress.json", "item.completed.mcp_tool_call.completed.json", true],
    ["web_search", "item.started.web_search.json", "item.completed.web_search.json", true],
  ])("correlates %s tool calls and results by item.id", (name, startedFixture, completedFixture, ok) => {
    const instance = parser();
    const call = instance.parse(fixture(startedFixture))[0];
    const result = instance.parse(fixture(completedFixture))[0];
    expect(call).toMatchObject({ type: "tool_call", name });
    expect(result).toMatchObject({ type: "tool_result", toolUseId: call?.type === "tool_call" ? call.toolUseId : "", ok });
  });

  it.each([
    ["item.completed.command_execution.completed.json", "item_3", true],
    ["item.completed.mcp_tool_call.failed.json", "item_1", false],
  ])("preserves the source item.id for standalone %s results", (completedFixture, itemId, ok) => {
    expect(parser().parse(fixture(completedFixture))[0]).toMatchObject({ type: "tool_result", toolUseId: itemId, ok });
  });

  it("maps turn usage into normalized token fields", () => {
    expect(parser().parse(fixture("turn.completed.json"))[0]).toMatchObject({
      type: "usage",
      consumption: { inputTokens: 15715, outputTokens: 5, cacheReadTokens: 11008, cacheCreationTokens: 0 },
    });
  });

  it("keeps reasoning, item errors, turn failures, and connection errors raw", () => {
    const instance = parser();
    for (const name of ["item.completed.reasoning.json", "item.completed.error.json", "turn.failed.json", "error.json"]) {
      expect(instance.parse(fixture(name))[0]?.type).toBe("raw");
    }
  });
});
