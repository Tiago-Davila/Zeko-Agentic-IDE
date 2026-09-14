import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApprovalPrompt } from './ApprovalPrompt';
import type { ApprovalDto } from './approvalApi';

const approval: ApprovalDto = {
  id: 'approval', actionRevision: 2, state: 'PENDING', actionProposalId: 'action',
  agentInstanceId: 'agent', taskId: 'task', executionId: 'execution', action: 'WRITE_LOCAL',
  resource: 'src/App.tsx', scope: 'worktree', effects: ['write file'], reason: '',
};

describe('ApprovalPrompt', () => {
  afterEach(cleanup);
  it('shows action context and decisions', () => {
    render(<ApprovalPrompt approval={approval} />);
    expect(screen.getByText('src/App.tsx')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Aceptar' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Denegar' })).not.toBeNull();
  });

  it('disables stale approval decisions', () => {
    render(<ApprovalPrompt approval={{ ...approval, state: 'INVALIDATED' }} />);
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('status').textContent).toContain('invalidada');
  });
});
