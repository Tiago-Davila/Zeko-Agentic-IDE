import {request} from '../../app/api/httpClient';
import type {ApprovalDto} from '../approvals/approvalApi';

export type ExecutionState =
    'PENDING'|'RUNNING'|'WAITING_APPROVAL'|'COMPLETED'|'FAILED'|'CANCELLED';
export type RuntimeProvider = 'DOCKER' | 'OLLAMA';

export interface RuntimeEffect {
  readonly id: string;
  readonly type: string;
  readonly resource: string;
  readonly confirmed: boolean;
  readonly detail: string;
}

export interface RuntimeExecution {
  readonly id: string;
  readonly taskId: string;
  readonly attempt: number;
  readonly state: ExecutionState;
  readonly knownState: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly retryOfExecutionId: string|null;
  readonly provider?: RuntimeProvider | null;
  readonly cancellationRequested: boolean;
  readonly effects: readonly RuntimeEffect[];
}

export interface RuntimeTask {
  readonly id: string;
  readonly repositoryId: string;
  readonly state: string;
  readonly title: string;
}

export interface RuntimeSnapshot {
  readonly projectId: string;
  readonly executions: readonly RuntimeExecution[];
  readonly tasks: readonly RuntimeTask[];
}

export interface RuntimeConflict {
  readonly id: string;
  readonly taskId: string;
  readonly type: string;
  readonly resources: readonly string[];
  readonly state: string;
  readonly resolution: string;
}

export interface ExecutionResult extends RuntimeExecution {
  readonly attributableDiff: string;
  readonly previousChanges: string;
}

export async function execution(executionId: string):
    Promise<RuntimeExecution> {
  return request(`/api/executions/${executionId}`);
}

export async function executionResult(executionId: string):
    Promise<ExecutionResult> {
  return request(`/api/executions/${executionId}/result`);
}

export async function requestCancellation(executionId: string):
    Promise<RuntimeExecution> {
  return request(`/api/executions/${executionId}/cancel-requests`,
                 {method : 'POST'});
}

export async function retryExecution(executionId: string):
    Promise<RuntimeExecution> {
  return request(`/api/executions/${executionId}/retries`, {method : 'POST'});
}

export async function runtimeSession(): Promise<void> {
  await request('/api/session/bootstrap', {method : 'POST'});
}

export async function runtimeSnapshot(projectId?: string): Promise<RuntimeSnapshot> {
  await runtimeSession();
  const body = await request<RuntimeSnapshot | readonly RuntimeExecution[]>(
      projectId === undefined || projectId === null
          ? '/api/runtime/snapshot'
          : `/api/projects/${projectId}/runtime-snapshot`);
  if (Array.isArray(body)) {
    return {projectId: projectId ?? '', executions: body, tasks: []};
  }
  return body as RuntimeSnapshot;
}

export async function runtimeProjectSnapshot(projectId: string): Promise<RuntimeSnapshot> {
  return runtimeSnapshot(projectId);
}

export async function pendingApprovals(projectId: string): Promise<readonly ApprovalDto[]> {
  await runtimeSession();
  return request(`/api/projects/${projectId}/approvals`);
}

export async function conflict(taskId: string): Promise<RuntimeConflict> {
  await runtimeSession();
  return request(`/api/tasks/${taskId}/conflict-resolution`);
}

export async function resolveConflict(
    taskId: string,
    resolution: 'CANCELLED'|'REASSIGNED'|'RESOLVED_MANUALLY',
    note = ''): Promise<RuntimeConflict> {
  await runtimeSession();
  return request(`/api/tasks/${taskId}/conflict-resolution`, {
    method : 'POST',
    headers : {'Content-Type': 'application/json'},
    body : JSON.stringify({resolution, note}),
  });
}
