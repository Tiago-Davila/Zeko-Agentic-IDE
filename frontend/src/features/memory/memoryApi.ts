import { request } from '../../app/api/httpClient';

export interface MemoryResult {
  readonly sourceId: string;
  readonly level: string;
  readonly ownerId?: string | null;
  readonly source?: string;
  readonly indexState?: 'CURRENT' | 'STALE' | 'UNAVAILABLE' | 'EXCLUDED';
  readonly excerpt: string;
}

export function searchMemory(projectId: string, query: string): Promise<{
  readonly results: readonly MemoryResult[];
}>;
export function searchMemory(projectId: string, conversationId: string, query: string): Promise<{
  readonly results: readonly MemoryResult[];
}>;
export async function searchMemory(projectId: string, second: string, third?: string): Promise<{
  readonly results: readonly MemoryResult[];
}> {
  await request('/api/session/bootstrap', { method: 'POST' });
  const parameters = new URLSearchParams(third === undefined
    ? { query: second }
    : { conversationId: second, query: third });
  return request(`/api/projects/${projectId}/memory/search?${parameters.toString()}`);
}
