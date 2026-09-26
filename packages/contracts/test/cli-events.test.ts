import { describe, expect, it } from "vitest";
import { CliEventSchema } from "../src/cli-events.js";

describe("CLI NDJSON events", () => {
  it("accepts the documented event variants", () => {
    expect(CliEventSchema.safeParse({ type: "validation", diagnostics: [] }).success).toBe(true);
    expect(CliEventSchema.safeParse({ type: "run.started", runId: "018f47e4-7b3a-7abc-8def-0123456789ab", flowId: "demo", origin: "cli", warnings: [] }).success).toBe(true);
  });

  it("rejects unknown event types and fields", () => {
    expect(CliEventSchema.safeParse({ type: "run.secret" }).success).toBe(false);
    expect(CliEventSchema.safeParse({ type: "validation", diagnostics: [], apiKey: "x" }).success).toBe(false);
  });
});
