import type { ProcessIdentity } from "@zeko/adapters";
import { getProcessSnapshot, ProcessSupervisor } from "@zeko/adapters";
import type { Redactor } from "@zeko/storage";
import { WorkspacesRepository } from "@zeko/storage";
import { RunsRepository } from "@zeko/storage";
import { ProcessTreeRepository } from "@zeko/storage";
import type { SqlDriver } from "@zeko/storage";

export interface RecoveryOptions {
  db: SqlDriver;
  runs: RunsRepository;
  redactor: Redactor;
  supervisor?: Pick<ProcessSupervisor, "terminateRecovered">;
  now?: () => string;
  hostIsAlive?: (pid: number, startedAt: number) => Promise<boolean> | boolean;
  currentProcesses?: () => Promise<readonly ProcessIdentity[]>;
}

export interface RecoveryResult { runIds: string[]; terminatedPids: number[] }

export async function recoverInterruptedRuns(options: RecoveryOptions): Promise<RecoveryResult> {
  const supervisor = options.supervisor ?? new ProcessSupervisor();
  const processes = new ProcessTreeRepository(options.db);
  const workspaces = new WorkspacesRepository(options.db);
  const now = options.now ?? (() => new Date().toISOString());
  const live = options.currentProcesses ?? (async () => getProcessSnapshot());
  const alive = options.hostIsAlive ?? (async (pid, startedAt) => {
    const identity = (await live()).find((process) => process.pid === pid);
    if (!identity) return false;
    return process.platform !== "win32" || identity.creationTime === startedAt;
  });
  const runIds: string[] = [];
  const terminatedPids: number[] = [];

  for (const candidate of options.runs.runningHosts()) {
    if (await alive(candidate.hostPid, candidate.hostStartedAt)) continue;
    const identities = processes.forRun(candidate.runId);
    const toTerminate = process.platform === "linux" ? identities.filter((identity) => identity.isRoot) : identities;
    for (const identity of toTerminate) {
      if (await supervisor.terminateRecovered({ pid: identity.pid, creationTime: identity.creationTime })) terminatedPids.push(identity.pid);
    }
    const at = now();
    options.db.transaction(() => {
      for (const node of options.runs.nodeRuns.nonterminal(candidate.runId)) {
        options.runs.nodeRuns.markRecovered(node.id, node.status === "pending" ? "skipped" : "interrupted");
      }
      workspaces.markUntrustedForRun(candidate.runId);
      options.runs.markInterrupted(candidate.runId, at);
    });
    await options.runs.append(options.redactor.redact({
      runId: candidate.runId, ts: at, type: "run.interrupted", payload: { detectedAt: at, mode: "recovered" },
    }));
    runIds.push(candidate.runId);
  }
  return { runIds, terminatedPids };
}
