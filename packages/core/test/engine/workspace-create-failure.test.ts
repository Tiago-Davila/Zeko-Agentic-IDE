import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers.js";

describe("RunEngine workspace creation failures", () => {
  it("fails with WORKSPACE_CREATE_FAILED instead of reporting an agent launch error", async () => {
    const { engine } = makeEngine([]);
    engine.options.workspace = {
      async create() {
        throw Object.assign(new Error("invalid worktree path"), {
          code: "WORKSPACE_CREATE_FAILED" as const,
        });
      },
      async remove() {
        return Promise.resolve();
      },
    };
    const result = await engine.execute();
    expect(result.nodeRuns.get("a")).toMatchObject({
      status: "failed",
      reason: { code: "WORKSPACE_CREATE_FAILED" },
    });
  });
});
