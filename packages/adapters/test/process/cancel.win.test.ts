import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FakeAdapter } from "../../src/fake/fake-adapter.ts";
import { ProcessSupervisor } from "../../src/process/supervisor.ts";
import { getProcessSnapshot } from "../../src/process/process-table.ts";
import type { AgentCapabilities, LaunchSpec } from "@zeko/contracts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe.runIf(process.platform === "win32")("Windows supervised cancellation", () => {
  it("stops a writing grandchild, removes every registered identity, and leaves an unrelated sleeper alive under 10s", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zeko-cancel-win-"));
    temporaryDirectories.push(directory);
    const scenarioPath = join(directory, "slow-grandchild.json");
    await writeFile(scenarioPath, JSON.stringify({
      spawnGrandchildSeconds: 60,
      emitFinalEvent: false,
      hangUntilInterrupt: true,
      interruptMode: "respond",
    }), "utf8");

    const supervisor = new ProcessSupervisor();
    const adapter = new FakeAdapter({
      scenarioPath,
      supervisor,
      capabilities: { win32: { ...fakeCapabilitiesWithoutInterrupt(), orderlyInterrupt: false } },
    });
    const unrelatedSupervisor = new ProcessSupervisor();
    let execution: ReturnType<FakeAdapter["launch"]> | undefined;
    let unrelated: Awaited<ReturnType<ProcessSupervisor["launch"]>> | undefined;
    try {
      execution = adapter.launch(makeLaunchSpec(directory));
      unrelated = await unrelatedSupervisor.launch("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 600"], { cwd: directory });
      const progressPath = join(directory, "fake-grandchild.log");
      await waitUntil(async () => {
        try { return (await readFile(progressPath, "utf8")).trim().split(/\r?\n/).length >= 2; }
        catch { return false; }
      }, 8_000);
      await supervisor.refresh();
      const recorded = supervisor.registeredProcesses(execution.rootPid);
      expect(recorded.length).toBeGreaterThanOrEqual(3);
      const start = Date.now();
      await execution.cancel("user");
      const elapsed = Date.now() - start;
      await expect(execution.completion).resolves.toMatchObject({ outcome: { kind: "killed", by: "user", phase: "tree_kill" } });
      const sizeAtCancel = (await readFile(progressPath, "utf8")).length;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const sizeAfterFiveSeconds = (await readFile(progressPath, "utf8")).length;
      expect(sizeAfterFiveSeconds).toBe(sizeAtCancel);
      const finalSnapshot = await getProcessSnapshot("win32");
      for (const identity of recorded) {
        expect(finalSnapshot.some((entry) => entry.pid === identity.pid && entry.creationTime === identity.creationTime)).toBe(false);
      }
      expect(finalSnapshot).toContainEqual(expect.objectContaining(unrelated.rootPid));
      expect(elapsed).toBeLessThan(10_000);
    } finally {
      if (execution) await execution.cancel("shutdown").catch(() => undefined);
      if (unrelated) await unrelatedSupervisor.terminate(unrelated.rootPid).catch(() => undefined);
      await Promise.all([adapter.dispose(), supervisor.dispose(), unrelatedSupervisor.dispose()]);
    }
  }, 30_000);
});

function makeLaunchSpec(workspacePath: string): LaunchSpec {
  return {
    agentId: "fake",
    runId: "018f0000-0000-7000-8000-000000000201",
    nodeRunId: "018f0000-0000-7000-8000-000000000202",
    attemptId: "018f0000-0000-7000-8000-000000000203",
    workspacePath,
    model: { model: "fake-model" },
    prompt: "cancel process tree",
    reportSchema: {},
    writeScope: ["**"],
    terminal: { enabled: false, allowedCommands: [] },
    platform: "win32",
  };
}

function fakeCapabilitiesWithoutInterrupt(): AgentCapabilities {
  return {
    terminal: { canDisable: true },
    confinement: { noTerminal: "full", withTerminal: "write_only" },
    writeScopeEnforcement: { unrestricted: "prevent", partial: "prevent" },
    commandAllowlist: { supported: true, shell: "PowerShell", readonlyAutoApproved: false },
    reportsDenials: true,
    infersDenials: false,
    supportsTurnLimit: true,
    timeLimit: "engine",
    orderlyInterrupt: false,
    network: "none",
    structuredOutput: true,
    reportRequest: "exec_fork",
    explicitModel: true,
    reportsCost: true,
    reportsConsumption: true,
    subscriptionUsage: "live",
    authModes: [{ mode: "detect", verified: true }],
    infraFailureClasses: [],
    processTree: "windows_process_tree",
  };
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}
