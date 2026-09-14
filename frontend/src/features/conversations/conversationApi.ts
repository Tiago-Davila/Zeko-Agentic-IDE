import { request } from '../../app/api/httpClient';
export interface ConversationDto { readonly id: string; readonly projectId: string; readonly recipientType: 'PM' | 'AGENT'; readonly recipientId: string; }
export async function createConversation(projectId: string, recipientType: 'PM' | 'AGENT', recipientId: string): Promise<ConversationDto> { await request('/api/session/bootstrap', { method: 'POST' }); return request(`/api/projects/${projectId}/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientType, recipientId }) }); }
