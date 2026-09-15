import { request } from '../../app/api/httpClient';
export interface MemoryResult {
  readonly sourceId: string;
  readonly level: string;
  readonly ownerId: string;
  readonly source: string;
  readonly indexState: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
  readonly excerpt: string;
}

export async function searchMemory(
  projectId: string,
  conversationId: string,
  query: string,
): Promise<{ readonly results: readonly MemoryResult[] }> {
  const parameters = new URLSearchParams({ conversationId, query });
  return request(`/api/projects/${projectId}/memory/search?${parameters.toString()}`);
}
