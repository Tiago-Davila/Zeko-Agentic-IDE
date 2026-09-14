import { request } from '../../app/api/httpClient';

export interface AgentTemplateDto { readonly id: string; readonly projectId: string; readonly name: string; readonly version: number; }
export interface AgentInstanceDto { readonly id: string; readonly projectId: string; readonly templateId: string; readonly selectedTemplateVersion: number; readonly identity: string; readonly context: Readonly<Record<string, string>>; readonly state: string; }
async function session(): Promise<void> { await request('/api/session/bootstrap', { method: 'POST' }); }
export async function templates(projectId: string): Promise<readonly AgentTemplateDto[]> { await session(); return request(`/api/projects/${projectId}/agent-templates`); }
export async function createTemplate(projectId: string, name: string, configuration: object): Promise<AgentTemplateDto> { await session(); return request(`/api/projects/${projectId}/agent-templates`, json('POST', { name, configuration })); }
export async function createInstance(projectId: string, templateVersionId: string, identity: string): Promise<AgentInstanceDto> { await session(); return request(`/api/projects/${projectId}/agent-instances`, json('POST', { templateVersionId, identity, context: {} })); }
function json(method: string, body: object): RequestInit { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
