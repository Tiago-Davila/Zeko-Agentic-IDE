import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createZekoRuntime, IPC_EVENT_TYPES, IPC_METHODS } from "../src/index.js";

const expectedMethods = ["project.open", "flow.list", "flow.load", "flow.create", "flow.save", "flow.delete", "flow.validate", "flow.validateEdge", "agents.status", "run.preflight", "run.start", "run.cancel", "node.cancel", "approval.decide", "run.list", "run.get", "node.output.page", "node.diff", "workspaces.delete", "settings.get", "settings.set"];
const expectedEvents = ["run.started", "node.state", "node.output", "node.result", "approval.requested", "agent.usage", "run.held", "run.resumed", "run.finished", "flow.fileChanged", "runs.recovered", "engine.error"];

describe("runtime IPC composition", () => {
  it("maps every contract method and event type", () => {
    expect([...IPC_METHODS]).toEqual(expectedMethods);
    expect([...IPC_EVENT_TYPES]).toEqual(expectedEvents);
  });

  it("exposes one callable handler for every IPC request method", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-runtime-"));
    const runtime = await createZekoRuntime({ dbPath: join(root, "zeko.db"), worktreeRoot: join(root, "wt") });
    try {
      expect(Object.keys(runtime.ipcHandlers).sort()).toEqual([...expectedMethods].sort());
      expect(Object.values(runtime.ipcHandlers).every((handler) => typeof handler === "function")).toBe(true);
    } finally { runtime.close(); await rm(root, { recursive: true, force: true }); }
  });
});
