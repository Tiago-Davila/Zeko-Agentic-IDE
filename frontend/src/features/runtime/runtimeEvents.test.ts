import { describe, expect, it } from 'vitest';
import { createRuntimeReconciler, type RuntimeEvent } from './runtimeEvents';

const execution = { id: 'execution', taskId: 'task', attempt: 1, state: 'RUNNING' as const, knownState: 'RUNNING', templateId: 'template', templateVersion: 1, retryOfExecutionId: null, cancellationRequested: false, effects: [] };

describe('runtime event reconciliation', () => {
  it('deduplicates event ids and tracks sequences independently by resource', async () => {
    let snapshots = 0;
    const reconciler = createRuntimeReconciler(async () => { snapshots += 1; return [execution]; });
    const first: RuntimeEvent = { eventId: 'one', resourceId: 'task-a', sequence: 1, execution };
    expect(await reconciler.accept(first)).toBe(true);
    expect(await reconciler.accept(first)).toBe(false);
    expect(await reconciler.accept({ ...first, eventId: 'two', resourceId: 'task-b' })).toBe(true);
    expect(snapshots).toBe(0);
  });
});
