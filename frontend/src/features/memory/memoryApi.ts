import { request } from '../../app/api/httpClient';
export interface MemoryResult { readonly sourceId: string; readonly level: string; readonly excerpt: string; }
export async function searchMemory(projectId: string, ownerId: string, query: string): Promise<{ readonly results: readonly MemoryResult[] }> { return request(`/api/projects/${projectId}/memory/search?ownerId=${encodeURIComponent(ownerId)}&query=${encodeURIComponent(query)}`); }
