import { describe, expect, it } from 'vitest';
import { getDocumentRefetchInterval } from './document-polling';
import type { DocumentSummary } from '@/types/api';

function documentWithStatus(status: DocumentSummary['status']): DocumentSummary {
  return { id: 'id', originalName: 'test.pdf', mimeType: 'application/pdf', sizeBytes: '100', pageCount: null, status, errorCode: null, createdAt: '', processedAt: null };
}

describe('document polling', () => {
  it('polls only while ingestion is active', () => {
    expect(getDocumentRefetchInterval([documentWithStatus('PENDING')])).toBe(5000);
    expect(getDocumentRefetchInterval([documentWithStatus('PROCESSING')])).toBe(5000);
  });

  it('stops for terminal and empty states', () => {
    expect(getDocumentRefetchInterval([documentWithStatus('READY'), documentWithStatus('FAILED')])).toBe(false);
    expect(getDocumentRefetchInterval([])).toBe(false);
  });
});
