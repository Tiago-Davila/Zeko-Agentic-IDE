import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createInterface } from "node:readline";
import { getProcessSnapshot, type ProcessEntry } from "./process-table.ts";
import { ProcessTreeTracker, type ProcessIdentity } from "./tree-tracker.ts";

export interface ProcessSupervisorOptions {
  readonly platform?: NodeJS.Platform;
  readonly pollIntervalMs?: number;
  readonly snapshot?: () => Promise<ProcessEntry[]>;
  readonly spawn?: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
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
  readonly #active = new Set<ActiveProcess>();
  #timer: NodeJS.Timeout | undefined;
  #polling: Promise<void> | undefined;

  constructor(options: ProcessSupervisorOptions = {}) {
    this.#platform = options.platform ?? process.platform;
    this.#pollIntervalMs = options.pollIntervalMs ?? 2_000;
    this.#snapshot = options.snapshot ?? (() => getProcessSnapshot(this.#platform));
    this.#spawn = options.spawn ?? ((command, args, spawnOptions) => spawn(command, [...args], spawnOptions));
  }

  async launch(command: string, args: readonly string[], options: { readonly cwd: string; readonly env?: NodeJS.ProcessEnv }): Promise<SupervisedProcess> {
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
        this.#stopPollingWhenIdle();
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

  async #waitForRoot(pid: number): Promise<ProcessIdentity> {
    const deadline = Date.now() + 2_000;
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
    for (const tracked of this.#active) tracked.tracker.update(snapshot);
  }

  #stopPollingWhenIdle(): void {
    if ([...this.#active].some((tracked) => !tracked.closed)) return;
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

function writeToStdin(child: ChildProcess, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!child.stdin || child.stdin.destroyed || !child.stdin.writable) {
      reject(new Error("The supervised process stdin is no longer writable"));
      return;
    }
    child.stdin.write(line, "utf8", (error) => error ? reject(error) : resolve());
  });
}
