import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCodexRolloutJsonl } from "../../src/codex/rollout.ts";

describe("Codex rollout parsing", () => {
  it("extracts the effective model, both usage windows, duration, and rejection records", () => {
    const result = parseCodexRolloutJsonl(readFileSync(new URL("../fixtures/codex/rollout-sample.jsonl", import.meta.url), "utf8"), new Date("2026-09-26T12:00:00.000Z"));
    expect(result.model).toBe("gpt-5.4-mini");
    expect(result.effort).toBe("low");
    expect(result.durationMs).toBe(1234);
    expect(result.rejections).toHaveLength(1);
    expect(result.usage).toMatchObject({ agentId: "codex", live: false, source: "codex-rollout", windows: [{ name: "primary", utilization: 0.42, resetsAt: "2026-09-26T18:00:00.000Z" }, { name: "secondary", utilization: 0.12 }] });
  });

  it("ignores malformed and partial JSONL records", () => {
    expect(parseCodexRolloutJsonl("{bad json\n{\"type\":\"task_complete\",\"duration_ms\":-1}")).toMatchObject({ rejections: [] });
  });
});
