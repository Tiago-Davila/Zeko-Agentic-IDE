import { request } from '../../app/api/httpClient';
export interface ConversationDto { readonly id: string; readonly projectId: string; readonly recipientType: 'PM' | 'AGENT'; readonly recipientId: string; }
export interface InstructionDto { readonly id: string; readonly origin: string; readonly content: string; readonly precedence: string; readonly overrideOf: string | null; }
export interface ConversationExchangeDto { readonly instruction: InstructionDto; readonly response: InstructionDto; readonly conversation: ConversationDto & { readonly instructions: readonly InstructionDto[] }; }
export async function createConversation(projectId: string, recipientType: 'PM' | 'AGENT', recipientId: string): Promise<ConversationDto> { await request('/api/session/bootstrap', { method: 'POST' }); return request(`/api/projects/${projectId}/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientType, recipientId }) }); }
export function createProjectManagerConversation(projectId: string): Promise<ConversationDto> { return createConversation(projectId, 'PM', projectId); }

export async function sendMessage(conversationId: string, content: string): Promise<ConversationExchangeDto> {
  await request('/api/session/bootstrap', { method: 'POST' });
  return request(`/api/conversations/${conversationId}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
  });
}
