import { describe, expect, it } from "vitest";
import { NormalizedEventSchema } from "../src/adapter/normalized-event.js";

describe("NormalizedEventSchema", () => {
  it("requires timestamp and attempt id for every event", () => {
    expect(NormalizedEventSchema.safeParse({ type: "assistant_text", text: "hello" }).success).toBe(false);
    expect(NormalizedEventSchema.safeParse({ type: "assistant_text", ts: "2026-01-01T00:00:00Z", attemptId: "018f47e4-7b3a-7abc-8def-0123456789ab", text: "hello" }).success).toBe(true);
  });

  it("supports all normalized event variants and rejects unknown payload keys", () => {
    const common = { ts: "2026-01-01T00:00:00Z", attemptId: "018f47e4-7b3a-7abc-8def-0123456789ab" };
    for (const type of ["session_started", "assistant_text", "tool_call", "tool_result", "permission_denied", "inferred_denial", "subscription_usage", "model_mismatch", "stderr", "raw"]) {
      expect(NormalizedEventSchema.safeParse({ ...common, type }).success).toBe(false);
    }
    expect(NormalizedEventSchema.safeParse({ ...common, type: "usage" }).success).toBe(true);
    expect(NormalizedEventSchema.safeParse({ ...common, type: "stderr", line: "x", secret: true }).success).toBe(false);
  });
});
