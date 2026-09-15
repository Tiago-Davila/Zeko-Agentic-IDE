import {runtimeSnapshot, type RuntimeExecution, type RuntimeSnapshot} from './runtimeApi';

export interface RuntimeEvent {
  readonly eventId: string;
  readonly resourceId: string;
  readonly sequence: number;
  readonly execution: RuntimeExecution;
}

export interface RuntimeReconciler {
  accept(event: RuntimeEvent): Promise<boolean>;
  executions(): readonly RuntimeExecution[];
  replace(snapshot: RuntimeSnapshot | readonly RuntimeExecution[]): void;
}

type SnapshotLoader = () => Promise<RuntimeSnapshot | readonly RuntimeExecution[]>;

export function createRuntimeReconciler(loadSnapshot: SnapshotLoader = runtimeSnapshot):
    RuntimeReconciler {
  const seen = new Set<string>();
  const sequences = new Map<string, number>();
  const state = new Map<string, RuntimeExecution>();

  async function reconcile(): Promise<void> {
    const snapshot = await loadSnapshot();
    applySnapshot(snapshot);
  }

  function replace(snapshot: RuntimeSnapshot | readonly RuntimeExecution[]): void {
    seen.clear();
    sequences.clear();
    applySnapshot(snapshot);
  }

  function applySnapshot(snapshot: RuntimeSnapshot | readonly RuntimeExecution[]): void {
    state.clear();
    for (const item of executionsFrom(snapshot))
      state.set(item.id, item);
  }

  return {
    async accept(event) {
      if (seen.has(event.eventId))
        return false;
      const previous = sequences.get(event.resourceId) ?? 0;
      if (event.sequence > previous + 1)
        await reconcile();
      if (event.sequence <= previous)
        return false;
      seen.add(event.eventId);
      sequences.set(event.resourceId, event.sequence);
      state.set(event.execution.id, event.execution);
      return true;
    },
    executions : () => [...state.values()],
    replace,
  };
}

function executionsFrom(snapshot: RuntimeSnapshot | readonly RuntimeExecution[]): readonly RuntimeExecution[] {
  return Array.isArray(snapshot) ? snapshot : (snapshot as RuntimeSnapshot).executions;
}
