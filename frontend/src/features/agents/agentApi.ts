import { request } from '../../app/api/httpClient';

export interface AgentTemplateDto { readonly id: string; readonly projectId: string; readonly name: string; readonly versionId: string; readonly version: number; }
export interface AgentInstanceDto { readonly id: string; readonly projectId: string; readonly templateId: string; readonly selectedTemplateVersion: number; readonly identity: string; readonly context: Readonly<Record<string, string>>; readonly state: string; }
export interface PermissionModeDto { readonly instanceId: string; readonly permissionMode: 'ASK_APPROVAL' | 'AUTO_APPROVE' | 'FULL_ACCESS'; readonly autoApproveRules: readonly string[]; }
export interface AutonomyModeDto { readonly instanceId: string; readonly autonomyMode: 'MANUAL' | 'ASSISTED' | 'AUTONOMOUS'; }
async function session(): Promise<void> { await request('/api/session/bootstrap', { method: 'POST' }); }
export async function templates(projectId: string): Promise<readonly AgentTemplateDto[]> { await session(); return request(`/api/projects/${projectId}/agent-templates`); }
export async function createTemplate(projectId: string, name: string, configuration: object): Promise<AgentTemplateDto> { await session(); return request(`/api/projects/${projectId}/agent-templates`, json('POST', { name, configuration })); }
export async function createInstance(projectId: string, templateVersionId: string, identity: string): Promise<AgentInstanceDto> { await session(); return request(`/api/projects/${projectId}/agent-instances`, json('POST', { templateVersionId, identity, context: {} })); }
export async function instances(projectId: string): Promise<readonly AgentInstanceDto[]> { await session(); return request(`/api/projects/${projectId}/agent-instances`); }
export async function permissionMode(instanceId: string): Promise<PermissionModeDto> { await session(); return request(`/api/agent-instances/${instanceId}/permission-mode`); }
export async function autonomyMode(instanceId: string): Promise<AutonomyModeDto> { await session(); return request(`/api/agent-instances/${instanceId}/autonomy-mode`); }
function json(method: string, body: object): RequestInit { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
