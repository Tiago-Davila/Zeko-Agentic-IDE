import { createHash } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface FlowFileChanged {
  readonly projectId: string;
  readonly flowId: string;
  /** Empty string denotes a deleted flow file. */
  readonly fileHash: string;
}

export class FlowWatcher {
  readonly #known = new Map<string, string>();
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #watcher: FSWatcher | undefined;
  #closed = false;

  constructor(
    private readonly projectId: string,
    private readonly projectRoot: string,
    private readonly onChanged: (change: FlowFileChanged) => void,
    private readonly settleMs = 40,
  ) {}

  async start(): Promise<void> {
    if (this.#watcher) return;
    const directory = join(this.projectRoot, ".zeko", "flows");
    await mkdir(directory, { recursive: true });
    this.#watcher = watch(directory, (_event, filename) => {
      if (filename === null) { void this.#scan(); return; }
      const name = filename.toString();
      if (name.endsWith(".flow.yaml")) this.#schedule(name);
    });
    const names = await readdir(directory);
    for (const name of names.filter((entry) => entry.endsWith(".flow.yaml"))) {
      try { this.#known.set(name.slice(0, -".flow.yaml".length), await hashFile(join(directory, name))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  }

  close(): void {
    this.#closed = true;
    this.#watcher?.close();
    this.#watcher = undefined;
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
  }

  async #scan(): Promise<void> {
    if (this.#closed) return;
    const directory = join(this.projectRoot, ".zeko", "flows");
    let names: string[];
    try { names = await readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    const found = new Set(names.filter((name) => name.endsWith(".flow.yaml")));
    for (const name of found) this.#schedule(name);
    for (const name of this.#known.keys()) if (!found.has(`${name}.flow.yaml`)) this.#schedule(`${name}.flow.yaml`);
  }

  #schedule(filename: string): void {
    const previous = this.#timers.get(filename);
    if (previous) clearTimeout(previous);
    this.#timers.set(filename, setTimeout(() => {
      this.#timers.delete(filename);
      void this.#publish(filename);
    }, this.settleMs));
  }

  async #publish(filename: string): Promise<void> {
    if (this.#closed) return;
    const flowId = filename.slice(0, -".flow.yaml".length);
    let fileHash = "";
    try {
      fileHash = await hashFile(join(this.projectRoot, ".zeko", "flows", filename));
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return; }
    if (this.#known.get(flowId) === fileHash) return;
    this.#known.set(flowId, fileHash);
    this.onChanged({ projectId: this.projectId, flowId, fileHash });
  }
}

async function hashFile(path: string): Promise<string> {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}
