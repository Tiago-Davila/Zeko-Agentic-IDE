import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { NormalizedEvent } from "@zeko/contracts";
import { ALL_FIXTURE_PATHS } from "../fixtures/index.ts";
import { parseFakeAgentScenario } from "./scenario.js";

const attemptId = "018f0000-0000-7000-8000-000000000101";
const event: NormalizedEvent = { type: "assistant_text", ts: "2026-09-25T00:00:00.000Z", attemptId, text: "hello" };
const testDir = dirname(fileURLToPath(import.meta.url));

describe("fake-agent scenario parser", () => {
  it("parses native events and applies deterministic defaults", () => {
    expect(parseFakeAgentScenario({ events: [event] })).toMatchObject({ mode: "native", events: [event], exitCode: 0, interruptMode: "respond", emitFinalEvent: true });
  });
  it("aggregates invalid event and unknown field errors", () => {
    expect(() => parseFakeAgentScenario({ events: [{ type: "assistant_text" }], surprise: true })).toThrow(/Unknown scenario field: surprise.*events\[0\]\.ts/s);
  });
  it("requires replay fixtures to come from the typed manifest", () => {
    expect(() => parseFakeAgentScenario({ mode: "replay", fixture: "../../secrets.json" })).toThrow(/typed fixture index/);
    expect(parseFakeAgentScenario({ mode: "replay", fixture: "claude/q1-verbose-raw.jsonl" }).mode).toBe("replay");
  });
  it("keeps every curated fixture indexed and every scenario JSON parseable", () => {
    const fixtureRoot = resolve(testDir, "../fixtures");
    for (const path of ALL_FIXTURE_PATHS) expect(existsSync(resolve(fixtureRoot, path))).toBe(true);
    const scenarioRoot = resolve(testDir, "scenarios");
    const scenarios = readdirSync(scenarioRoot).filter((file) => file.endsWith(".json"));
    expect(scenarios).toHaveLength(15);
    for (const file of scenarios) {
      expect(() => parseFakeAgentScenario(JSON.parse(readFileSync(join(scenarioRoot, file), "utf8")) as unknown), file).not.toThrow();
    }
  });
});
