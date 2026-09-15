import {request} from '../../app/api/httpClient';

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

export interface RuntimeSnapshot {
  readonly projectId: string;
  readonly executions: readonly RuntimeExecution[];
  readonly tasks: readonly unknown[];
}

export async function runtimeSnapshot(): Promise<readonly RuntimeExecution[]> {
  return request('/api/runtime/snapshot');
}

export async function runtimeProjectSnapshot(projectId: string): Promise<RuntimeSnapshot> {
  return request(`/api/projects/${projectId}/runtime-snapshot`);
}
