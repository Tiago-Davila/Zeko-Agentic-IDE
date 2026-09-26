import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createInterface } from "node:readline";
import { getProcessSnapshot, type ProcessEntry } from "./process-table.ts";
import { ProcessTreeTracker, type ProcessIdentity } from "./tree-tracker.ts";

export interface ProcessSupervisorOptions {
  readonly platform?: NodeJS.Platform;
  readonly pollIntervalMs?: number;
  readonly snapshot?: () => Promise<ProcessEntry[]>;
  readonly spawn?: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
  readonly killByPid?: (pid: number, tree: boolean) => Promise<void>;
  readonly signalProcessGroup?: (pgid: number, signal: NodeJS.Signals) => Promise<void>;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly terminationTimeoutMs?: number;
}

export interface SupervisedProcess {
  readonly rootPid: ProcessIdentity;
  readonly stdout: AsyncIterable<string>;
  readonly stderr: AsyncIterable<string>;
  readonly completion: Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>;
  writeStdin(line: string): Promise<void>;
}

interface ActiveProcess {
  readonly child: ChildProcess;
  readonly tracker: ProcessTreeTracker;
  closed: boolean;
}

export class ProcessSupervisor {
  readonly #platform: NodeJS.Platform;
  readonly #pollIntervalMs: number;
  readonly #snapshot: () => Promise<ProcessEntry[]>;
  readonly #spawn: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
  readonly #killByPid: (pid: number, tree: boolean) => Promise<void>;
  readonly #signalProcessGroup: (pgid: number, signal: NodeJS.Signals) => Promise<void>;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #terminationTimeoutMs: number;
  readonly #active = new Set<ActiveProcess>();
  #timer: NodeJS.Timeout | undefined;
  #polling: Promise<void> | undefined;

  constructor(options: ProcessSupervisorOptions = {}) {
    this.#platform = options.platform ?? process.platform;
    this.#pollIntervalMs = options.pollIntervalMs ?? 2_000;
    this.#snapshot = options.snapshot ?? (() => getProcessSnapshot(this.#platform));
    this.#spawn = options.spawn ?? ((command, args, spawnOptions) => spawn(command, [...args], spawnOptions));
    this.#killByPid = options.killByPid ?? killWindowsProcessByPid;
    this.#signalProcessGroup = options.signalProcessGroup ?? (async (pgid, signal) => { process.kill(-pgid, signal); });
    this.#sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.#terminationTimeoutMs = options.terminationTimeoutMs ?? 9_000;
  }

  async launch(command: string, args: readonly string[], options: { readonly cwd: string; readonly env?: NodeJS.ProcessEnv }): Promise<SupervisedProcess> {
    // Start the platform reader before the agent so its first OS query does not race a short-lived root.
    await this.#snapshot();
    const child = this.#spawn(command, args, {
      cwd: options.cwd,
      ...(options.env ? { env: options.env } : {}),
      shell: false,
      detached: this.#platform === "linux",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (!child.pid) throw new Error("The operating system did not assign a PID to the supervised process");
    const root = await this.#waitForRoot(child.pid);
    const tracked: ActiveProcess = { child, tracker: new ProcessTreeTracker(root), closed: false };
    this.#active.add(tracked);
    this.#startPolling();
    const completion = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => {
        tracked.closed = true;
        resolve({ code, signal });
        // Keep observing this tree after the root exits: an already-registered child can outlive it.
      });
    });
    if (!child.stdin || !child.stdout || !child.stderr) throw new Error("Supervised process stdio pipes were not created");
    return {
      rootPid: root,
      stdout: readLines(child.stdout),
      stderr: readLines(child.stderr),
      completion,
      writeStdin: (line) => writeToStdin(child, line),
    };
  }

  async dispose(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    this.#active.clear();
    await this.#polling?.catch(() => undefined);
  }

  async refresh(): Promise<void> {
    await this.#poll();
  }

  registeredProcesses(root: ProcessIdentity): ProcessIdentity[] {
    return [...this.#active].find((tracked) => sameIdentity(tracked.tracker.registered[0]!, root))?.tracker.registered ?? [];
  }

  async hasLiveDescendants(root: ProcessIdentity): Promise<boolean> {
    const tracked = [...this.#active].find((candidate) => sameIdentity(candidate.tracker.registered[0]!, root));
    if (!tracked) return false;
    const snapshot = await this.#snapshot();
    tracked.tracker.update(snapshot);
    return tracked.tracker.live(snapshot).some((identity) => !sameIdentity(identity, root));
  }

  async terminate(root: ProcessIdentity): Promise<void> {
    const tracked = [...this.#active].find((candidate) => sameIdentity(candidate.tracker.registered[0]!, root));
    if (!tracked) throw new Error("Only a registered process root can be terminated");

    let snapshot = await this.#snapshot();
    tracked.tracker.update(snapshot);
    const rootIsSameProcess = hasIdentity(snapshot, root);
    if (this.#platform === "win32") {
      if (rootIsSameProcess) {
        await this.#killByPid(root.pid, true);
        snapshot = await this.#snapshot();
      }
      for (const descendant of tracked.tracker.registered.filter((identity) => !sameIdentity(identity, root))) {
        if (hasIdentity(snapshot, descendant)) await this.#killByPid(descendant.pid, false);
      }
    } else if (this.#platform === "linux" && rootIsSameProcess) {
      await this.#signalProcessGroup(root.pid, "SIGTERM");
      await this.#sleep(200);
      snapshot = await this.#snapshot();
      tracked.tracker.update(snapshot);
      if (tracked.tracker.live(snapshot).length > 0) await this.#signalProcessGroup(root.pid, "SIGKILL");
    } else if (this.#platform !== "linux") {
      throw new Error(`Process termination is not implemented for ${this.#platform}`);
    }

    const deadline = Date.now() + this.#terminationTimeoutMs;
    do {
      snapshot = await this.#snapshot();
      if (tracked.tracker.live(snapshot).length === 0) {
        this.#active.delete(tracked);
        this.#stopPollingWhenIdle();
        return;
      }
      await this.#sleep(50);
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for registered process tree rooted at PID ${root.pid}`);
  }

  async #waitForRoot(pid: number): Promise<ProcessIdentity> {
    const deadline = Date.now() + 5_000;
    do {
      const snapshot = await this.#snapshot();
      const entry = snapshot.find((candidate) => candidate.pid === pid);
      if (entry) return { pid: entry.pid, creationTime: entry.creationTime };
      await new Promise((resolve) => setTimeout(resolve, 10));
    } while (Date.now() < deadline);
    throw new Error(`Could not register process identity for PID ${pid}`);
  }

  #startPolling(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      if (!this.#polling) this.#polling = this.#poll().finally(() => { this.#polling = undefined; });
    }, this.#pollIntervalMs);
    this.#timer.unref();
  }

  async #poll(): Promise<void> {
    if (this.#active.size === 0) return;
    const snapshot = await this.#snapshot();
    for (const tracked of [...this.#active]) {
      tracked.tracker.update(snapshot);
      if (tracked.closed && tracked.tracker.live(snapshot).length === 0) this.#active.delete(tracked);
    }
    this.#stopPollingWhenIdle();
  }

  #stopPollingWhenIdle(): void {
    if (this.#active.size > 0) return;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }
}

async function* readLines(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) yield line;
  } finally {
    lines.close();
  }
}

async function killWindowsProcessByPid(pid: number, tree: boolean): Promise<void> {
  if (process.platform !== "win32") throw new Error("Windows PID termination was requested on another platform");
  const args = ["/PID", String(pid), ...(tree ? ["/T"] : []), "/F"];
  await new Promise<void>((resolve, reject) => {
    const child = spawn("taskkill.exe", args, { shell: false, windowsHide: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      // A process can exit after its identity check and before taskkill opens it.
      // The final table verification below remains authoritative.
      if (code === 0 || code === 128 || code === 1) resolve();
      else reject(new Error(`taskkill failed for PID ${pid} (${code ?? "unknown exit"})`));
    });
  });
}

function sameIdentity(left: ProcessIdentity, right: ProcessIdentity): boolean {
  return left.pid === right.pid && left.creationTime === right.creationTime;
}

function hasIdentity(snapshot: readonly ProcessEntry[], identity: ProcessIdentity): boolean {
  return snapshot.some((entry) => entry.pid === identity.pid && entry.creationTime === identity.creationTime);
}

function writeToStdin(child: ChildProcess, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!child.stdin || child.stdin.destroyed || !child.stdin.writable) {
      reject(new Error("The supervised process stdin is no longer writable"));
      return;
    }
    child.stdin.write(line, "utf8", (error) => error ? reject(error) : resolve());
  });
}
