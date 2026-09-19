import { request } from '../../app/api/httpClient';

export type ApprovalState = 'PENDING' | 'APPROVED' | 'DENIED' | 'INVALIDATED';
export interface ApprovalDto {
  readonly id: string;
  readonly actionRevision: number;
  readonly state: ApprovalState;
  readonly actionProposalId: string;
  readonly agentInstanceId: string | null;
  readonly taskId: string | null;
  readonly executionId: string;
  readonly action: string;
  readonly resource: string;
  readonly scope: string;
  readonly effects: readonly string[];
  readonly reason: string;
}

export async function getApproval(approvalId: string): Promise<ApprovalDto> {
  return request(`/api/approvals/${approvalId}`);
}

export async function decideApproval(
  approvalId: string,
  actionRevision: number,
  decision: 'APPROVE' | 'DENY',
  reason = '',
): Promise<ApprovalDto> {
  return request(`/api/approvals/${approvalId}/decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionRevision, decision, reason }),
  });
}
