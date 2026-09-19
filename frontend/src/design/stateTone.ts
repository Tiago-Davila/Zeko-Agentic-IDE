export type StateTone = 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled' | 'blocked';

/*
 * Mapeo unico de estado a color. Cubre Execution.State, Task.State, Approval.State,
 * RepositoryAccessState, MemoryEntry.IndexState, Worktree.State y ConflictRecord.State.
 * Los valores repetidos entre modulos ya comparten semantica.
 */
const tonesByState: Readonly<Record<string, StateTone>> = {
  // Execution.State y Task.State
  PENDING: 'pending',
  DRAFT: 'pending',
  READY: 'pending',
  RUNNING: 'running',
  WAITING_APPROVAL: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',

  // Approval.State
  APPROVED: 'completed',
  DENIED: 'failed',
  INVALIDATED: 'cancelled',

  // RepositoryAccessState
  AVAILABLE: 'completed',
  UNAVAILABLE: 'failed',
  INVALID: 'failed',

  // MemoryEntry.IndexState
  CURRENT: 'completed',
  STALE: 'waiting',
  EXCLUDED: 'cancelled',

  // Worktree.State
  RESERVED: 'pending',
  ACTIVE: 'running',
  RELEASE_PENDING: 'waiting',
  RELEASED: 'cancelled',
  CONFLICTED: 'blocked',

  // ConflictRecord.State
  OPEN: 'blocked',
  REASSIGNED: 'waiting',
  RESOLVED_MANUALLY: 'completed',
};

export function toneOf(state: string): StateTone {
  return tonesByState[state] ?? 'pending';
}
