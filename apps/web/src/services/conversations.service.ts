import { authorizedFetch, request } from './api';
import type { ConversationDetail, ConversationSummary } from '@/types/api';

export interface StreamCallbacks {
  onChunk(text: string): void;
  onDone(data: { messageId: string; citations: number[]; invalidCitations: number[] }): void;
}

async function streamMessage(conversationId: string, question: string, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
  const response = await authorizedFetch(`/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST', body: JSON.stringify({ question }), signal,
  });
  if (!response.body) throw new Error('Streaming is not supported by this browser.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';
    for (const block of events) {
      const event = block.match(/^event:\s*(.+)$/m)?.[1];
      const dataLine = block.match(/^data:\s*(.+)$/m)?.[1];
      if (!event || !dataLine) continue;
      const data = JSON.parse(dataLine) as Record<string, unknown>;
      if (event === 'chunk') callbacks.onChunk(String(data.text ?? ''));
      if (event === 'done') callbacks.onDone(data as unknown as Parameters<StreamCallbacks['onDone']>[0]);
      if (event === 'error') throw new Error(String(data.message ?? 'Chat generation failed.'));
    }
    if (done) break;
  }
}

export const conversationsService = {
  create: (documentIds: string[]) => request<{ conversation: { id: string } }>('/api/v1/conversations', { method: 'POST', body: JSON.stringify({ documentIds }) }),
  list: (documentIds?: string[]) => {
    const selected = documentIds ? [...new Set(documentIds)].sort() : [];
    const query = selected.length > 0 ? `?documentIds=${encodeURIComponent(selected.join(','))}` : '';
    return request<{ conversations: ConversationSummary[] }>(`/api/v1/conversations${query}`);
  },
  get: (conversationId: string) => request<{ conversation: ConversationDetail }>(`/api/v1/conversations/${conversationId}`),
  remove: (conversationId: string) => request<void>(`/api/v1/conversations/${conversationId}`, { method: 'DELETE' }),
  streamMessage,
};
