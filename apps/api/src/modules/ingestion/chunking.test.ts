import { describe, expect, it } from 'vitest';
import { chunkPages, normalizePdfText } from './chunking.js';

describe('PDF chunking', () => {
  it('normalizes whitespace and repairs line-break hyphenation', () => {
    expect(normalizePdfText('A  useful hyphen-\nated\n\n\nparagraph')).toBe('A useful hyphenated\n\nparagraph');
  });

  it('creates overlapping chunks with page ranges', () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: 'one two three four' },
      { pageNumber: 2, text: 'five six seven eight' },
    ], 5, 2);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ content: 'one two three four five', pageStart: 1, pageEnd: 2, tokenCount: 5 });
    expect(chunks[1]).toMatchObject({ content: 'four five six seven eight', pageStart: 1, pageEnd: 2, tokenCount: 5 });
  });

  it('rejects overlap that cannot advance', () => {
    expect(() => chunkPages([{ pageNumber: 1, text: 'hello' }], 4, 4)).toThrow();
  });
});
