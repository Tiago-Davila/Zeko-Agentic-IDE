import { describe, expect, it } from "vitest";
import type { AgentUsageReading } from "@zeko/contracts";
import { UsageGate, usageGate } from "../../src/scheduler/usage-gate.js";

const reading = (utilization: number, readAt = "2026-01-01T00:00:00.000Z", resetsAt?: string): AgentUsageReading => ({
  agentId: "codex", authMode: "subscription",
  windows: [{ name: "five_hour", utilization, ...(resetsAt ? { resetsAt } : {}) }],
  readAt, live: false, source: "test",
});

describe("usageGate", () => {
  it("holds at the configured threshold and allows one launch in the 80–90 percent band", () => {
    const gate = new UsageGate();
    expect(gate.check("codex", reading(0.9), 0.9, "2026-01-01T00:00:01.000Z").held).toBe(true);
    expect(gate.check("codex", reading(0.85), 0.9, "2026-01-01T00:00:01.000Z").held).toBe(false);
    expect(gate.check("codex", reading(0.85), 0.9, "2026-01-01T00:00:02.000Z")).toMatchObject({ held: true, nearLimit: true });
  });
  it("resets the launch allowance on a new reading and ignores windows past resetsAt", () => {
    const gate = new UsageGate();
    expect(gate.check("codex", reading(0.85), 0.9, "2026-01-01T00:00:01.000Z").held).toBe(false);
    expect(gate.check("codex", reading(0.85, "2026-01-01T00:01:00.000Z"), 0.9, "2026-01-01T00:01:01.000Z").held).toBe(false);
    expect(usageGate(reading(0.99, "2026-01-01T00:00:00.000Z", "2025-12-31T23:59:00.000Z"), 0.9, "2026-01-01T00:00:00.000Z").held).toBe(false);
  });
});
