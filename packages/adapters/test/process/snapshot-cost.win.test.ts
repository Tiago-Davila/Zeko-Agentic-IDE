import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessSupervisor } from "../../src/process/supervisor.ts";
import { disposeProcessSnapshotWorker, getProcessSnapshot } from "../../src/process/process-table.ts";
import type { ProcessIdentity } from "../../src/process/tree-tracker.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe.runIf(process.platform === "win32")("Windows process snapshot budget", () => {
  it("closes and can recreate the persistent query worker", async () => {
    try {
      await expect(getProcessSnapshot("win32")).resolves.toContainEqual(expect.objectContaining({ pid: process.pid }));
      disposeProcessSnapshotWorker();
      await expect(getProcessSnapshot("win32")).resolves.toContainEqual(expect.objectContaining({ pid: process.pid }));
    } finally {
      disposeProcessSnapshotWorker();
    }
  }, 20_000);

  it("tracks eight active roots with one Win32_Process query under the 200ms NFR-002 budget", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zeko-snapshot-cost-"));
    temporaryDirectories.push(directory);
    let snapshotCalls = 0;
    const supervisor = new ProcessSupervisor({
      pollIntervalMs: 60_000,
      snapshot: async () => {
        snapshotCalls += 1;
        return getProcessSnapshot("win32");
      },
    });
    const roots: ProcessIdentity[] = [];
    try {
      for (let index = 0; index < 8; index += 1) {
        const launched = await supervisor.launch(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { cwd: directory });
        roots.push(launched.rootPid);
      }
      snapshotCalls = 0;
      const start = performance.now();
      await supervisor.refresh();
      const elapsedMs = performance.now() - start;
      expect(snapshotCalls).toBe(1);
      expect(elapsedMs).toBeLessThan(200);
    } finally {
      await Promise.all(roots.map((root) => supervisor.terminate(root).catch(() => undefined)));
      await supervisor.dispose();
    }
  }, 60_000);
});
