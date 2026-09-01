import { describe, expect, it } from 'vitest';
import { toEmbeddingContents } from './ai.service.js';

describe('Gemini embedding request shape', () => {
  it('creates one explicit Content object per chunk', () => {
    expect(toEmbeddingContents(['first', 'second'])).toEqual([
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'user', parts: [{ text: 'second' }] },
    ]);
  });
});
