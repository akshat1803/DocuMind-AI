import { describe, expect, it } from 'vitest';
import { createDraftChatUrl, readDraftDocumentIds } from './chat-route';

describe('draft chat routes', () => {
  it('normalizes the selected PDFs without creating a conversation id', () => {
    expect(createDraftChatUrl(['b', 'a', 'a'])).toBe('/chat/new?documents=a%2Cb');
  });

  it('restores selected PDFs from the draft query string', () => {
    expect(readDraftDocumentIds(new URLSearchParams('documents=b%2Ca%2Cb'))).toEqual(['a', 'b']);
  });
});
