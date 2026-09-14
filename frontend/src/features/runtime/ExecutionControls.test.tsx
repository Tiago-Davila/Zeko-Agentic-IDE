import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExecutionControls } from './ExecutionControls';
import type { RuntimeExecution } from './runtimeApi';

const execution: RuntimeExecution = { id: 'execution', taskId: 'task', attempt: 1, state: 'RUNNING', knownState: 'RUNNING', templateId: 'template', templateVersion: 1, retryOfExecutionId: null, cancellationRequested: false, effects: [] };

describe('ExecutionControls', () => {
  afterEach(cleanup);
  it('does not label an active execution as cancelled before confirmation', () => {
    render(<ExecutionControls execution={execution} onUpdated={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', false);
    expect(screen.queryByText('CANCELLED')).toBeNull();
  });
});
