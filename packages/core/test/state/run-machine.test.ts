import { describe, expect, it } from "vitest";
import { calculateRunOutcome, finishRun, transitionRun } from "../../src/state/run-machine.js";

describe("run state machine", () => {
  it("finishes only after all nodes are terminal and calculates the outcome", () => {
    expect(finishRun(["completed", "approved"])).toEqual({ status: "finished", outcome: "all_succeeded" });
    expect(finishRun(["completed", "failed"])).toEqual({ status: "finished", outcome: "some_not_succeeded" });
    expect(calculateRunOutcome(["completed", "running"])).toBeUndefined();
  });
  it("allows a running run to finish, cancel, or interrupt only", () => {
    expect(transitionRun("running", "interrupted")).toBe("interrupted");
    expect(() => transitionRun("finished", "cancelled")).toThrow("Invalid run transition");
  });
});
