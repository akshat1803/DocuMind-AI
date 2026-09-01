import pdf from 'pdf-parse';
import { normalizePdfText, PdfPage } from './chunking.js';

interface PdfTextItem { str?: string; transform?: number[] }
interface PdfPageData {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

function renderPage(pages: PdfPage[]) {
  return async (pageData: PdfPageData): Promise<string> => {
    const content = await pageData.getTextContent();
    let previousY: number | undefined;
    const parts: string[] = [];
    for (const item of content.items) {
      const value = item.str?.trim();
      if (!value) continue;
      const y = item.transform?.[5];
      if (previousY !== undefined && y !== undefined && Math.abs(y - previousY) > 4) parts.push('\n');
      parts.push(value);
      previousY = y;
    }
    const text = normalizePdfText(parts.join(' '));
    pages.push({ pageNumber: pages.length + 1, text });
    return text;
  };
}

export async function extractPdfPages(buffer: Buffer): Promise<PdfPage[]> {
  const pages: PdfPage[] = [];
  const result = await pdf(buffer, { pagerender: renderPage(pages) });
  if (pages.length === 0 && result.text.trim()) pages.push({ pageNumber: 1, text: normalizePdfText(result.text) });
  if (pages.every((page) => page.text.length === 0)) throw new Error('PDF_HAS_NO_EXTRACTABLE_TEXT');
  return pages;
}
