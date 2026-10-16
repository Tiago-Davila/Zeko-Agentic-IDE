import { NodeStatusSchema, ReasonSchema, type NodeStatus } from "@zeko/contracts";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ZekoEvent } from "../ipc/client.js";
import { ipc } from "../ipc/client.js";

export interface LiveNodeState { status: NodeStatus; reason?: typeof ReasonSchema._output; hold?: string }
type Snapshot = Readonly<Record<string, LiveNodeState>>;
const EMPTY: Snapshot = Object.freeze({});

export class RunStateStore {
  readonly #snapshots = new Map<string, Snapshot>();
  readonly #listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (runId: string | undefined): Snapshot => runId ? this.#snapshots.get(runId) ?? EMPTY : EMPTY;

  accept(event: ZekoEvent): void {
    if (event.type !== "node.state" || !event.runId || typeof event.payload !== "object" || event.payload === null) return;
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload["nodeId"] !== "string") return;
    const status = NodeStatusSchema.safeParse(payload["status"]);
    if (!status.success) return;
    const current = this.getSnapshot(event.runId);
    const reason = ReasonSchema.safeParse(payload["reason"]);
    const nodeState: LiveNodeState = {
      status: status.data,
      ...(reason.success ? { reason: reason.data } : {}),
      ...(typeof payload["hold"] === "string" ? { hold: payload["hold"] } : {}),
    };
    this.#snapshots.set(event.runId, Object.freeze({ ...current, [payload["nodeId"]]: Object.freeze(nodeState) }));
    for (const listener of this.#listeners) listener();
  }
}

export const runStateStore = new RunStateStore();

export function useRunState(runId: string | undefined): Snapshot {
  useEffect(() => ipc.onEvent((event) => runStateStore.accept(event)), []);
  const getSnapshot = useCallback(() => runStateStore.getSnapshot(runId), [runId]);
  return useSyncExternalStore(runStateStore.subscribe, getSnapshot, getSnapshot);
}
