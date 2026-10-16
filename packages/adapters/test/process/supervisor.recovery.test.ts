import { describe, expect, it } from "vitest";
import { ProcessSupervisor } from "../../src/process/supervisor.js";

describe("recovered process identity termination", () => {
  it("refuses stale PID reuse and terminates only after matching creationTime", async () => {
    let kills = 0;
    const supervisor = new ProcessSupervisor({ platform: "win32", snapshot: async () => [{ pid: 44, parentPid: 1, creationTime: 500 }], killByPid: async (pid, tree) => { expect(pid).toBe(44); expect(tree).toBe(false); kills += 1; } });
    expect(await supervisor.terminateRecovered({ pid: 44, creationTime: 499 })).toBe(false);
    expect(kills).toBe(0);
    expect(await supervisor.terminateRecovered({ pid: 44, creationTime: 500 })).toBe(true);
    expect(kills).toBe(1);
    await supervisor.dispose();
  });
});
