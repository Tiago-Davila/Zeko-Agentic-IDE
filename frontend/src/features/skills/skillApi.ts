import { request } from '../../app/api/httpClient';
export interface SkillDto { readonly id: string; readonly projectId: string; readonly name: string; readonly skillPath: string; readonly scope: string; }
async function session(): Promise<void> { await request('/api/session/bootstrap', { method: 'POST' }); }
export async function skills(projectId: string): Promise<readonly SkillDto[]> { await session(); return request(`/api/projects/${projectId}/skills`); }
