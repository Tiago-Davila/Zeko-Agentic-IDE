import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ClaudeStreamParser } from "../../src/claude-code/parser.ts";

const fixture = (relative: string): string => readFileSync(new URL(`../fixtures/claude/${relative}`, import.meta.url), "utf8").trim();
const attemptId = "018f0000-0000-7000-8000-000000000003";
const parser = (requestedModel = "claude-sonnet-5") => new ClaudeStreamParser({
  attemptId,
  requestedModel,
  now: () => new Date("2026-09-20T12:00:00.000Z"),
});

describe("Claude stream-json parser", () => {
  it("maps system/init to session metadata and reports a mismatched effective model", () => {
    const parsed = parser("claude-requested-model").parse(fixture("events/system.init.json"));
    expect(parsed.map((event) => event.type)).toEqual(["session_started", "model_mismatch"]);
    expect(parsed[0]).toMatchObject({ sessionId: "57910248-3c54-41d5-96bd-995ef20e8d2f", model: "claude-sonnet-5", agentVersion: "2.1.280", attemptId });
    expect(parsed[1]).toMatchObject({ requested: "claude-requested-model", effective: "claude-sonnet-5" });
  });

  it("keeps assistant blocks loose, labels subagents, and drops thinking", () => {
    const instance = parser();
    const line = JSON.stringify({
      type: "assistant", parent_tool_use_id: "task-1", message: { id: "same-message", content: [
        { type: "thinking", thinking: "private reasoning" },
        { type: "text", text: "visible" },
        { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "x" } },
      ] },
    });
    const first = instance.parse(line);
    const repeated = instance.parse(line);
    expect([...first, ...repeated].map((event) => event.type)).toEqual(["assistant_text", "tool_call", "assistant_text", "tool_call"]);
    expect(first[0]).toMatchObject({ text: "visible", subagent: "task-1" });
    expect(first[1]).toMatchObject({ toolUseId: "tool-1", name: "Read", input: { file_path: "x" } });
    expect(JSON.stringify(first)).not.toContain("private reasoning");
  });

  it("maps tool results and permission denials while deduplicating by tool use id", () => {
    const instance = parser();
    const toolResult = instance.parse(fixture("events/user.tool_result_error.json"));
    const denied = fixture("events/system.permission_denied.json");
    const firstDenial = instance.parse(denied);
    const duplicateDenial = instance.parse(denied);
    expect(toolResult[0]).toMatchObject({ type: "tool_result", ok: false });
    expect(firstDenial).toHaveLength(1);
    expect(firstDenial[0]).toMatchObject({ type: "permission_denied", tool: "Write" });
    expect(duplicateDenial).toEqual([]);
  });

  it("does not merge distinct denied tool calls that have the same tool and input", () => {
    const instance = parser();
    const common = { type: "system", subtype: "permission_denied", tool_name: "Write", message: "outside scope", input: { file_path: "outside.txt" } };
    expect(instance.parse(JSON.stringify({ ...common, tool_use_id: "denied-1" }))).toHaveLength(1);
    expect(instance.parse(JSON.stringify({ ...common, tool_use_id: "denied-2" }))).toHaveLength(1);
    expect(instance.parse(JSON.stringify(common))).toHaveLength(1);
    expect(instance.parse(JSON.stringify(common))).toEqual([]);
  });

  it("maps live rate-limit windows, keeps the maximum windows, and drops expired readings", () => {
    const instance = parser();
    const usage = instance.parse(fixture("events/rate_limit_event.json"));
    expect(usage[0]).toMatchObject({ type: "subscription_usage", live: true, agentId: "claude-code", windows: [{ name: "five_hour", utilization: 0.33 }, { name: "seven_day", utilization: 0.03 }] });
    const expired = instance.parse(JSON.stringify({ type: "rate_limit_event", rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.8, resetsAt: 1700000000 } } } }));
    expect(expired).toEqual([]);
  });

  it("retains the final result and exposes denials from result.permission_denials only once", () => {
    const instance = parser();
    const denial = { tool_name: "Write", tool_use_id: "denied-1", message: "outside scope", input: { file_path: "outside.txt" } };
    expect(instance.parse(JSON.stringify({ type: "system", subtype: "permission_denied", ...denial }))).toHaveLength(1);
    const result = { type: "result", is_error: false, permission_denials: [denial], structured_output: { status: "COMPLETED" } };
    expect(instance.parse(JSON.stringify(result))).toEqual([]);
    expect(instance.result).toMatchObject({ is_error: false, structured_output: { status: "COMPLETED" } });
  });

  it("falls back to raw for unknown messages without leaking thinking events", () => {
    const parsed = parser().parse(fixture("events/system.thinking_tokens.json"));
    expect(parsed[0]).toMatchObject({ type: "raw" });
  });
});
