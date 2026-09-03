import { describe, expect, it } from 'vitest';
import { addCitationLinks } from './MarkdownAnswer';

describe('Markdown answer citations', () => {
  it('turns only saved citation markers into internal links', () => {
    const citations = [{
      id: 'citation-1', citationNumber: 1, excerpt: 'Source text', similarityScore: 0.9, chunkId: 'chunk-1',
    }];

    expect(addCitationLinks('Supported [1], unknown [2], existing [link](https://example.com).', citations))
      .toBe('Supported [1](citation:1), unknown [2], existing [link](https://example.com).');
  });
});
