export const NEW_CONVERSATION_ID = 'new';

export function normalizeDocumentIds(documentIds: string[]): string[] {
  return [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))].sort();
}

export function createDraftChatUrl(documentIds: string[]): string {
  const selected = normalizeDocumentIds(documentIds);
  return `/chat/${NEW_CONVERSATION_ID}?documents=${encodeURIComponent(selected.join(','))}`;
}

export function readDraftDocumentIds(searchParams: URLSearchParams): string[] {
  return normalizeDocumentIds((searchParams.get('documents') ?? '').split(','));
}
