import { describe, expect, it } from "vitest";
import { IpcErrorSchema, IpcEventSchema, IpcRequestSchema, IpcResponseSchema, NodeViewSchema } from "../src/ipc.js";

describe("IPC schemas", () => {
  it("validates request, response, and event envelopes", () => {
    const id = "018f47e4-7b3a-7abc-8def-0123456789ab";
    expect(IpcRequestSchema.safeParse({ kind: "request", id, method: "run.start", params: {} }).success).toBe(true);
    expect(IpcResponseSchema.safeParse({ kind: "response", id, ok: true, result: {} }).success).toBe(true);
    expect(IpcEventSchema.safeParse({ kind: "event", type: "run.started", runId: id, payload: {}, seq: 1 }).success).toBe(true);
  });

  it("requires currentHash for FILE_CHANGED_ON_DISK", () => {
    expect(IpcErrorSchema.safeParse({ code: "FILE_CHANGED_ON_DISK", params: {} }).success).toBe(false);
    expect(IpcErrorSchema.safeParse({ code: "FILE_CHANGED_ON_DISK", params: { currentHash: "sha256" } }).success).toBe(true);
  });

  it("includes model and warnings in NodeView", () => {
    expect(NodeViewSchema.safeParse({ nodeId: "review", model: { model: "gpt-6-luna", reasoningEffort: "low", source: "node" }, warnings: ["MODEL_DEFAULTED"], confinement: { level: "write_only" }, notApplicable: [] }).success).toBe(true);
  });
});
