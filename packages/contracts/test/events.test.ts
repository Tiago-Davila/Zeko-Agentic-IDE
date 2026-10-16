import { describe, expect, it } from "vitest";
import { PersistedEventSchema } from "../src/events.js";

describe("PersistedEventSchema", () => {
  it("accepts the inferred denial event with correlation ids", () => {
    expect(PersistedEventSchema.safeParse({
      runId: "018f47e4-7b3a-7abc-8def-0123456789ab", ts: "2026-01-01T00:00:00Z",
      type: "agent.inferred_denial", payload: { source: "os_sandbox", message: "Access denied" },
    }).success).toBe(true);
  });

  it("rejects an unknown event type and unknown payload field", () => {
    const base = { runId: "018f47e4-7b3a-7abc-8def-0123456789ab", ts: "2026-01-01T00:00:00Z" };
    expect(PersistedEventSchema.safeParse({ ...base, type: "agent.secret", payload: {} }).success).toBe(false);
    expect(PersistedEventSchema.safeParse({ ...base, type: "agent.inferred_denial", payload: { source: "patch", message: "x", email: "x" } }).success).toBe(false);
  });
});
