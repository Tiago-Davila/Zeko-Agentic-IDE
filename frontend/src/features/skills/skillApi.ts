import { request } from '../../app/api/httpClient';
export interface SkillDto { readonly id: string; readonly projectId: string; readonly name: string; readonly skillPath: string; readonly scope: string; }
export interface SkillBindingDto { readonly id: string; readonly agentInstanceId: string; readonly skillDefinitionId: string; readonly state: string; }
async function session(): Promise<void> { await request('/api/session/bootstrap', { method: 'POST' }); }
export async function skills(projectId: string): Promise<readonly SkillDto[]> { await session(); return request(`/api/projects/${projectId}/skills`); }
export async function registerSkill(projectId: string, name: string, skillPath: string): Promise<SkillDto> {
  await session();
  return request(`/api/projects/${projectId}/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, skillPath }) });
}
export async function bindSkill(instanceId: string, skillDefinitionId: string): Promise<SkillBindingDto> {
  await session();
  return request(`/api/agent-instances/${instanceId}/skill-bindings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillDefinitionId }) });
}
