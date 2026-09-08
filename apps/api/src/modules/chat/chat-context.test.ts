import { describe, expect, it } from 'vitest';
import { boundedHistory } from './chat-context.js';

describe('chat history context', () => {
  it('keeps only completed recent messages within the context cap', () => {
    const history = boundedHistory([
      { role: 'USER', content: 'old', status: 'COMPLETED' },
      { role: 'ASSISTANT', content: 'streaming', status: 'STREAMING' },
      ...Array.from({ length: 7 }, (_, index) => ({ role: 'USER', content: `message-${index}`, status: 'COMPLETED' })),
    ]);

    expect(history).not.toContain('old');
    expect(history).not.toContain('streaming');
    expect(history).toContain('message-6');
    expect(history.length).toBeLessThanOrEqual(12_000);
  });
});
