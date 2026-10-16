import type { ProcessEntry } from "./process-table.ts";

export interface ProcessIdentity {
  readonly pid: number;
  readonly creationTime: number;
}

export class ProcessTreeTracker {
  readonly #root: ProcessIdentity;
  readonly #registered = new Map<string, ProcessIdentity>();

  constructor(root: ProcessIdentity) {
    validateIdentity(root);
    this.#root = { pid: root.pid, creationTime: root.creationTime };
    this.#registered.set(identityKey(root), this.#root);
  }

  get registered(): ProcessIdentity[] {
    return [...this.#registered.values()];
  }

  update(snapshot: readonly ProcessEntry[]): readonly ProcessIdentity[] {
    const byPid = new Map(snapshot.map((entry) => [entry.pid, entry]));
    const currentTree = new Map<string, ProcessEntry>();
    for (const identity of this.#registered.values()) {
      const entry = byPid.get(identity.pid);
      if (entry && entry.creationTime === identity.creationTime) currentTree.set(identityKey(identity), entry);
    }

    let changed = true;
    while (changed) {
      changed = false;
      const registeredParents = new Set([...currentTree.values()].map((entry) => entry.pid));
      for (const entry of snapshot) {
        if (!registeredParents.has(entry.parentPid)) continue;
        const parent = byPid.get(entry.parentPid);
        if (!parent || !currentTree.has(identityKey(parent))) continue;
        const identity = { pid: entry.pid, creationTime: entry.creationTime };
        const key = identityKey(identity);
        if (this.#registered.has(key)) {
          currentTree.set(key, entry);
          continue;
        }
        this.#registered.set(key, identity);
        currentTree.set(key, entry);
        changed = true;
      }
    }
    return this.registered;
  }

  live(snapshot: readonly ProcessEntry[]): ProcessIdentity[] {
    const byPid = new Map(snapshot.map((entry) => [entry.pid, entry]));
    return [...this.#registered.values()].filter((identity) => byPid.get(identity.pid)?.creationTime === identity.creationTime);
  }
}

function identityKey(identity: ProcessIdentity): string {
  return `${identity.pid}:${identity.creationTime}`;
}

function validateIdentity(identity: ProcessIdentity): void {
  if (!Number.isSafeInteger(identity.pid) || identity.pid <= 0 || !Number.isSafeInteger(identity.creationTime) || identity.creationTime < 0) {
    throw new Error("A process identity requires a positive PID and a non-negative creation time");
  }
}
