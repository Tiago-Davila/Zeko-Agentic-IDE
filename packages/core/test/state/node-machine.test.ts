import { describe, expect, it } from "vitest";
import { canTransitionNode, isTerminalNodeStatus, transitionNode } from "../../src/state/node-machine.js";

describe("node state machine", () => {
  it("allows valid agent, approval, and input transitions", () => {
    expect(transitionNode("pending", "running", "agent")).toBe("running");
    expect(transitionNode("pending", "completed", "input")).toBe("completed");
    expect(transitionNode("pending", "waiting_approval", "approval")).toBe("waiting_approval");
    expect(transitionNode("waiting_approval", "approved", "approval")).toBe("approved");
  });
  it("rejects invalid transitions and distinguishes terminal statuses", () => {
    expect(canTransitionNode("completed", "running")).toBe(false);
    expect(() => transitionNode("pending", "approved", "approval")).toThrow("Invalid");
    expect(isTerminalNodeStatus("interrupted")).toBe(true);
    expect(isTerminalNodeStatus("running")).toBe(false);
  });
});
