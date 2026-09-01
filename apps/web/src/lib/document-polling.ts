import type { DocumentSummary } from '@/types/api';

export function getDocumentRefetchInterval(documents: DocumentSummary[] | undefined): number | false {
  return documents?.some((document) => document.status === 'PENDING' || document.status === 'PROCESSING') ? 5000 : false;
}
