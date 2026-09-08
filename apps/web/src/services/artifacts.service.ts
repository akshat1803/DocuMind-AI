import { request } from './api';
import type { AnalysisArtifact, ArtifactKind, NoteItem } from '@/types/api';

export const artifactsService = {
  list: () => request<{ artifacts: AnalysisArtifact[] }>('/api/v1/artifacts'),
  create: (kind: ArtifactKind, documentIds: string[]) => request<{ artifact: AnalysisArtifact }>('/api/v1/artifacts', { method: 'POST', body: JSON.stringify({ kind, documentIds }) }),
  saveQuizAttempt: (artifactId: string, score: number, answers: Record<string, number>) => request(`/api/v1/artifacts/${artifactId}/attempts`, { method: 'POST', body: JSON.stringify({ score, answers }) }),
  listNotes: () => request<{ notes: NoteItem[] }>('/api/v1/artifacts/notes'),
  createNote: (data: { content: string; documentId?: string; conversationId?: string }) => request<{ note: NoteItem }>('/api/v1/artifacts/notes', { method: 'POST', body: JSON.stringify(data) }),
};
