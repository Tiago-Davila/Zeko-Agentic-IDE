import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { ProcessSupervisor } from "../../src/process/supervisor.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ProcessSupervisor.launch", () => {
  it("launches fake-agent without a shell, streams lines, and resolves completion on close", async () => {
    const directory = await temporaryDirectory();
    const scenario = join(directory, "scenario.json");
    await writeFile(scenario, JSON.stringify({ hangUntilInterrupt: true, interruptMode: "respond" }));
    const supervisor = new ProcessSupervisor({ pollIntervalMs: 20 });
    try {
      const launched = await supervisor.launch(process.execPath, [
        "--experimental-strip-types", join(process.cwd(), "packages/adapters/test/fake-agent/main.ts"), scenario,
      ], { cwd: directory });
      expect(launched.rootPid.pid).toBeGreaterThan(0);
      expect(launched.rootPid.creationTime).toBeGreaterThan(0);
      const stdout = launched.stdout[Symbol.asyncIterator]();
      const stderr = readOneLine(launched.stderr);
      await expect(stdout.next()).resolves.toMatchObject({ value: expect.stringContaining('"type":"assistant_text"') });
      await launched.writeStdin(`${JSON.stringify({ type: "control_request", subtype: "interrupt", requestId: "launch-test" })}\n`);
      await expect(stdout.next()).resolves.toMatchObject({ value: expect.stringContaining('"type":"raw"') });
      await expect(stdout.next()).resolves.toMatchObject({ done: true });
      await expect(stderr).resolves.toBeUndefined();
      await expect(launched.completion).resolves.toMatchObject({ code: 130 });
    } finally {
      await supervisor.dispose();
    }
  });

  it("uses spawn with shell disabled and waits for close rather than exit", async () => {
    const child = new FakeChild();
    const spawn = vi.fn((_command: string, _args: readonly string[], options: SpawnOptions) => {
      expect(options.shell).toBe(false);
      expect(options.stdio).toEqual(["pipe", "pipe", "pipe"]);
      return child as unknown as ChildProcess;
    });
    const supervisor = new ProcessSupervisor({
      snapshot: async () => [{ pid: 73, parentPid: 2, creationTime: 730 }],
      spawn,
      pollIntervalMs: 60_000,
    });
    try {
      const launched = await supervisor.launch("agent.exe", ["--flag"], { cwd: process.cwd() });
      expect(spawn).toHaveBeenCalledOnce();
      child.emit("exit", 0, null);
      let settled = false;
      void launched.completion.then(() => { settled = true; });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(settled).toBe(false);
      child.stdout.end();
      child.stderr.end();
      child.emit("close", 0, null);
      await expect(launched.completion).resolves.toEqual({ code: 0, signal: null });
    } finally {
      await supervisor.dispose();
    }
  });

  it("takes one process snapshot per tracking tick for all active roots", async () => {
    const child = new FakeChild();
    let calls = 0;
    const supervisor = new ProcessSupervisor({
      snapshot: async () => { calls += 1; return [{ pid: 73, parentPid: 2, creationTime: 730 }]; },
      spawn: () => child as unknown as ChildProcess,
      pollIntervalMs: 15,
    });
    try {
      await supervisor.launch("one", [], { cwd: process.cwd() });
      await supervisor.launch("two", [], { cwd: process.cwd() });
      const beforeTick = calls;
      await new Promise((resolve) => setTimeout(resolve, 35));
      expect(calls - beforeTick).toBeGreaterThan(0);
      expect(calls - beforeTick).toBeLessThanOrEqual(3);
    } finally {
      await supervisor.dispose();
    }
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zeko-supervisor-"));
  tempDirs.push(directory);
  return directory;
}

async function readOneLine(lines: AsyncIterable<string>): Promise<string | undefined> {
  for await (const line of lines) return line;
  return undefined;
}

class FakeChild extends EventEmitter {
  readonly pid = 73;
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
}
