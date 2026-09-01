import { request } from './api';
import type { DocumentSummary } from '@/types/api';

export const documentsService = {
  list: () => request<{ documents: DocumentSummary[] }>('/api/v1/documents'),
  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ document: DocumentSummary }>('/api/v1/documents', { method: 'POST', body });
  },
  remove: (documentId: string) => request<void>(`/api/v1/documents/${documentId}`, { method: 'DELETE' }),
  retry: (documentId: string) => request<{ status: string }>(`/api/v1/documents/${documentId}/retry`, { method: 'POST', body: '{}' }),
  source: (documentId: string) => request<{ url: string; expiresInSeconds: number }>(`/api/v1/documents/${documentId}/source`),
};
