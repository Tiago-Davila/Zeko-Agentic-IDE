import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { ProcessSupervisor } from "../../src/process/supervisor.ts";
import type { ProcessEntry } from "../../src/process/process-table.ts";

describe("ProcessSupervisor.terminate", () => {
  it("kills the verified Windows root tree and only registered matching descendants", async () => {
    let snapshot: ProcessEntry[] = [{ pid: 100, parentPid: 1, creationTime: 1000 }];
    const killByPid = vi.fn(async (pid: number, tree: boolean) => {
      if (tree) snapshot = snapshot.filter((entry) => entry.pid !== 100);
      else snapshot = snapshot.filter((entry) => entry.pid !== pid);
    });
    const supervisor = new ProcessSupervisor({
      platform: "win32", snapshot: async () => snapshot,
      spawn: () => new FakeChild() as unknown as ChildProcess,
      killByPid, pollIntervalMs: 60_000,
    });
    try {
      const launched = await supervisor.launch("agent.exe", [], { cwd: process.cwd() });
      snapshot = [
        { pid: 100, parentPid: 1, creationTime: 1000 },
        { pid: 101, parentPid: 100, creationTime: 1010 },
        { pid: 200, parentPid: 1, creationTime: 2000 },
      ];
      await supervisor.refresh();
      await supervisor.terminate(launched.rootPid);
      expect(killByPid.mock.calls).toEqual([[100, true], [101, false]]);
    } finally {
      await supervisor.dispose();
    }
  });

  it("never touches a reused root PID or its unrelated tree", async () => {
    let snapshot: ProcessEntry[] = [{ pid: 100, parentPid: 1, creationTime: 1000 }];
    const killByPid = vi.fn(async () => undefined);
    const supervisor = new ProcessSupervisor({
      platform: "win32", snapshot: async () => snapshot,
      spawn: () => new FakeChild() as unknown as ChildProcess,
      killByPid, pollIntervalMs: 60_000,
    });
    try {
      const launched = await supervisor.launch("agent.exe", [], { cwd: process.cwd() });
      snapshot = [
        { pid: 100, parentPid: 1, creationTime: 9000 },
        { pid: 102, parentPid: 100, creationTime: 9010 },
      ];
      await supervisor.terminate(launched.rootPid);
      expect(killByPid).not.toHaveBeenCalled();
    } finally {
      await supervisor.dispose();
    }
  });

  it("skips a descendant whose PID was reused after it was registered", async () => {
    let snapshot: ProcessEntry[] = [{ pid: 100, parentPid: 1, creationTime: 1000 }];
    const killByPid = vi.fn(async (pid: number, tree: boolean) => {
      if (tree) snapshot = snapshot.filter((entry) => entry.pid !== 100);
      else snapshot = snapshot.filter((entry) => entry.pid !== pid);
    });
    const supervisor = new ProcessSupervisor({
      platform: "win32", snapshot: async () => snapshot,
      spawn: () => new FakeChild() as unknown as ChildProcess,
      killByPid, pollIntervalMs: 60_000,
    });
    try {
      const launched = await supervisor.launch("agent.exe", [], { cwd: process.cwd() });
      snapshot = [{ pid: 100, parentPid: 1, creationTime: 1000 }, { pid: 101, parentPid: 100, creationTime: 1010 }];
      await supervisor.refresh();
      snapshot = [{ pid: 100, parentPid: 1, creationTime: 1000 }, { pid: 101, parentPid: 9, creationTime: 9999 }];
      await supervisor.terminate(launched.rootPid);
      expect(killByPid.mock.calls).toEqual([[100, true]]);
    } finally {
      await supervisor.dispose();
    }
  });

  it("uses a detached Linux process group, never the child handle", async () => {
    let snapshot: ProcessEntry[] = [{ pid: 100, parentPid: 1, creationTime: 1000 }];
    const signalProcessGroup = vi.fn(async (_pgid: number, signal: NodeJS.Signals) => {
      if (signal === "SIGKILL") snapshot = [];
    });
    const supervisor = new ProcessSupervisor({
      platform: "linux", snapshot: async () => snapshot,
      spawn: (_command, _args, options) => {
        expect(options.detached).toBe(true);
        return new FakeChild() as unknown as ChildProcess;
      },
      signalProcessGroup, sleep: async () => undefined, pollIntervalMs: 60_000,
    });
    try {
      const launched = await supervisor.launch("agent", [], { cwd: process.cwd() });
      await supervisor.terminate(launched.rootPid);
      expect(signalProcessGroup.mock.calls).toEqual([[100, "SIGTERM"], [100, "SIGKILL"]]);
    } finally {
      await supervisor.dispose();
    }
  });
});

class FakeChild extends EventEmitter {
  readonly pid = 100;
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
}
