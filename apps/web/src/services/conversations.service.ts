import { authorizedFetch, request } from './api';
import type { ConversationDetail, ConversationSummary } from '@/types/api';

export interface StreamCallbacks {
  onChunk(text: string): void;
  onStarted?(data: { messageId: string; requestId: string }): void;
  onDone(data: { messageId: string; citations: number[]; invalidCitations: number[]; followUpActions?: Array<{ label: string; question: string }> }): void;
}

interface SendMessageOptions { requestId: string; retryMessageId?: string }

async function streamMessage(conversationId: string, question: string, callbacks: StreamCallbacks, options: SendMessageOptions, signal?: AbortSignal): Promise<void> {
  const response = await authorizedFetch(`/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST', body: JSON.stringify({ question, ...options }), signal,
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
      if (event === 'started') callbacks.onStarted?.(data as unknown as { messageId: string; requestId: string });
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
  rename: (conversationId: string, title: string) => request<{ success: true }>(`/api/v1/conversations/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  streamMessage,
};
