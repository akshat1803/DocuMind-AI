export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  content: string;
  pageStart: number;
  pageEnd: number;
  tokenCount: number;
}

interface PageToken {
  value: string;
  pageNumber: number;
}

export function normalizePdfText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/([a-z])-[ \t]*\n[ \t]*([a-z])/gi, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tokenizePage(page: PdfPage): PageToken[] {
  const normalized = normalizePdfText(page.text);
  return (normalized.match(/\S+/g) ?? []).map((value) => ({ value, pageNumber: page.pageNumber }));
}

export function chunkPages(pages: PdfPage[], maxTokens = 800, overlapTokens = 120): TextChunk[] {
  if (maxTokens < 1) throw new Error('maxTokens must be positive');
  if (overlapTokens < 0 || overlapTokens >= maxTokens) throw new Error('overlapTokens must be between 0 and maxTokens - 1');

  const tokens = pages.flatMap(tokenizePage);
  const chunks: TextChunk[] = [];
  const step = maxTokens - overlapTokens;

  for (let start = 0; start < tokens.length; start += step) {
    const slice = tokens.slice(start, start + maxTokens);
    if (slice.length === 0) break;
    chunks.push({
      content: slice.map((token) => token.value).join(' '),
      pageStart: slice[0].pageNumber,
      pageEnd: slice[slice.length - 1].pageNumber,
      tokenCount: slice.length,
    });
    if (start + maxTokens >= tokens.length) break;
  }
  return chunks;
}
