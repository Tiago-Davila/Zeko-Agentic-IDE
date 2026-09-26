import { describe, expect, it } from "vitest";
import { ProcessTreeTracker } from "../../src/process/tree-tracker.ts";
import type { ProcessEntry } from "../../src/process/process-table.ts";

const root = { pid: 10, creationTime: 100 };
const process = (pid: number, parentPid: number, creationTime: number): ProcessEntry => ({ pid, parentPid, creationTime });

describe("ProcessTreeTracker", () => {
  it("records the transitive descendant closure regardless of snapshot order", () => {
    const tracker = new ProcessTreeTracker(root);
    tracker.update([process(12, 11, 120), process(10, 1, 100), process(11, 10, 110)]);
    expect(tracker.registered).toEqual([root, { pid: 11, creationTime: 110 }, { pid: 12, creationTime: 120 }]);
  });

  it("keeps a grandchild registered after an intermediate parent exits", () => {
    const tracker = new ProcessTreeTracker(root);
    tracker.update([process(10, 1, 100), process(11, 10, 110), process(12, 11, 120)]);
    tracker.update([process(10, 1, 100), process(12, 11, 120)]);
    expect(tracker.registered).toContainEqual({ pid: 12, creationTime: 120 });
    expect(tracker.live([process(10, 1, 100), process(12, 11, 120)])).toEqual([
      { pid: 10, creationTime: 100 }, { pid: 12, creationTime: 120 },
    ]);
  });

  it("does not attach a process to a reused parent PID or track a reused root PID", () => {
    const tracker = new ProcessTreeTracker(root);
    tracker.update([process(10, 1, 200), process(11, 10, 210)]);
    expect(tracker.registered).toEqual([root]);
    expect(tracker.live([process(10, 1, 200), process(11, 10, 210)])).toEqual([]);
  });

  it("tracks descendants regardless of user identity because the process table has no user filter", () => {
    const tracker = new ProcessTreeTracker(root);
    tracker.update([process(10, 1, 100), process(15, 10, 150)]);
    expect(tracker.registered).toContainEqual({ pid: 15, creationTime: 150 });
  });

  it("deduplicates repeated snapshots by (pid, creationTime)", () => {
    const tracker = new ProcessTreeTracker(root);
    const snapshot = [process(10, 1, 100), process(11, 10, 110)];
    tracker.update(snapshot);
    tracker.update(snapshot);
    expect(tracker.registered).toEqual([root, { pid: 11, creationTime: 110 }]);
  });
});
