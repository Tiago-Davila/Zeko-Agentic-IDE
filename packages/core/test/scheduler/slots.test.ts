import { describe, expect, it } from "vitest";
import { InMemorySlotLeasePort } from "@zeko/testing";
import { SlotCoordinator } from "../../src/scheduler/slots.js";

describe("SlotCoordinator", () => {
  it("enforces a project wide limit and releases leases", async () => {
    const port = new InMemorySlotLeasePort();
    const firstRun = new SlotCoordinator(port, "project", 1);
    const secondRun = new SlotCoordinator(port, "project", 1);
    expect(await firstRun.acquire("node-a")).toBe(true);
    expect(await secondRun.acquire("node-b")).toBe(false);
    await firstRun.heartbeat("node-a");
    expect(port.leases.get("node-a")?.heartbeatCount).toBe(1);
    await firstRun.release("node-a");
    expect(await secondRun.acquire("node-b")).toBe(true);
    await secondRun.release("node-b");
  });
  it("allows up to the configured global capacity without agent sub-limits", async () => {
    const port = new InMemorySlotLeasePort();
    const coordinator = new SlotCoordinator(port, "project", 8);
    for (let index = 0; index < 8; index += 1) expect(await coordinator.acquire(`node-${index}`)).toBe(true);
    expect(await coordinator.acquire("ninth")).toBe(false);
    expect(coordinator.activeCount).toBe(8);
  });
});
