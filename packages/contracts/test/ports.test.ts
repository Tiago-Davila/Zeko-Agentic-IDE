import { describe, expect, expectTypeOf, it } from "vitest";
import type { ClockPort, RunStorePort, SlotLeasePort, UsageStorePort, WorkspacePort } from "../src/ports.js";

describe("core port contracts", () => {
  it("exposes async persistence and workspace boundaries", () => {
    expectTypeOf<WorkspacePort["create"]>().returns.toEqualTypeOf<Promise<{ path: string; branch: string }>>();
    expectTypeOf<RunStorePort["append"]>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<ClockPort["now"]>().returns.toEqualTypeOf<string>();
    expectTypeOf<SlotLeasePort["acquire"]>().returns.toEqualTypeOf<Promise<boolean>>();
    expectTypeOf<UsageStorePort["readLatest"]>().returns.toMatchTypeOf<Promise<unknown>>();
    expect(true).toBe(true);
  });
});
