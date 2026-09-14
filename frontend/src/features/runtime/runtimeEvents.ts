import {type RuntimeExecution, runtimeSnapshot} from './runtimeApi';

export interface RuntimeEvent {
  readonly eventId: string;
  readonly resourceId: string;
  readonly sequence: number;
  readonly execution: RuntimeExecution;
}

export interface RuntimeReconciler {
  accept(event: RuntimeEvent): Promise<boolean>;
  executions(): readonly RuntimeExecution[];
}

export function createRuntimeReconciler(loadSnapshot = runtimeSnapshot):
    RuntimeReconciler {
  const seen = new Set<string>();
  const sequences = new Map<string, number>();
  const state = new Map<string, RuntimeExecution>();

  async function reconcile(): Promise<void> {
    const snapshot = await loadSnapshot();
    for (const item of snapshot)
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
  };
}
