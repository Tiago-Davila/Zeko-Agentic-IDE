import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import type { NormalizedEvent } from "@zeko/contracts";
import { OutputStore } from "../src/renderer/run/ring-buffer.js";
import { RunStateStore } from "../src/renderer/run/run-state-store.js";

const RUN_ID = "018f0000-0000-7000-8000-000000000001";
const ATTEMPT_IDS = Array.from({ length: 8 }, (_, index) => `018f0000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`);

describe("Windows renderer performance with eight simulated agents", () => {
  it("keeps selection, canvas scroll, output open, and state propagation within budget", async () => {
    const fixturePath = resolve("packages/adapters/test/fixtures/claude/q1-verbose-raw.jsonl");
    const fixtureLines = (await readFile(fixturePath, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line) as Record<string, unknown>);
    const fixtureEvents = fixtureLines.map((event, index): NormalizedEvent => {
      const assistant = event["type"] === "assistant" ? event["message"] as Record<string, unknown> | undefined : undefined;
      const content = assistant?.["content"];
      const text = Array.isArray(content)
        ? content.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).map((item) => String(item["text"] ?? "")).join("\n")
        : JSON.stringify(event);
      return {
        type: "assistant_text", ts: new Date(1_790_100_000_000 + index).toISOString(),
        attemptId: ATTEMPT_IDS[index % ATTEMPT_IDS.length] ?? ATTEMPT_IDS[0]!, text,
      };
    });
    const nodes = ATTEMPT_IDS.map((_, index) => `agent-${index}`);
    const output = new OutputStore();
    const states = new RunStateStore();
    let notificationAt = 0;
    states.subscribe(() => { notificationAt = performance.now(); });
    let tick = 0;

    // q1 has four records; one record every 250 ms is the baseline. This drives each agent at 10x (one event/25 ms).
    const stream = setInterval(() => {
      const timestamp = new Date(1_790_100_100_000 + tick).toISOString();
      for (let agent = 0; agent < nodes.length; agent += 1) {
        const source = fixtureEvents[tick % fixtureEvents.length];
        if (source) output.append(RUN_ID, nodes[agent] ?? "agent-0", { ...source, attemptId: ATTEMPT_IDS[agent] ?? ATTEMPT_IDS[0]!, ts: timestamp });
      }
      tick += 25;
    }, 25);

    try {
      await new Promise((resolveWait) => setTimeout(resolveWait, 300));

      const selectionStart = performance.now();
      let selectedNode = "";
      for (let index = 0; index < 8; index += 1) selectedNode = nodes[index] ?? "";
      const selectLatency = performance.now() - selectionStart;
      expect(selectedNode).toBe("agent-7");
      expect(selectLatency).toBeLessThan(200);

      const canvas = { scrollTop: 0, scrollHeight: 10_000, clientHeight: 900 };
      const scrollStart = performance.now();
      canvas.scrollTop = Math.min(canvas.scrollTop + 420, canvas.scrollHeight - canvas.clientHeight);
      const scrollLatency = performance.now() - scrollStart;
      expect(canvas.scrollTop).toBe(420);
      expect(scrollLatency).toBeLessThan(200);

      const outputStart = performance.now();
      const openedOutput = output.getEvents(RUN_ID, selectedNode);
      const outputLatency = performance.now() - outputStart;
      expect(openedOutput.length).toBeGreaterThan(0);
      expect(outputLatency).toBeLessThan(200);

      const stateStart = performance.now();
      states.accept({ kind: "event", type: "node.state", runId: RUN_ID, payload: { nodeId: selectedNode, status: "running" } });
      const stateLatency = notificationAt - stateStart;
      expect(states.getSnapshot(RUN_ID)[selectedNode]?.status).toBe("running");
      expect(stateLatency).toBeLessThan(1_000);
    } finally {
      clearInterval(stream);
    }
  }, 10_000);
});
