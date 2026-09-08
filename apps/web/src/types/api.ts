export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface DocumentSummary {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  pageCount: number | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  errorCode: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Citation {
  id: string;
  citationNumber: number;
  excerpt: string;
  similarityScore: string | number | null;
  chunkId: string | null;
  documentId: string | null;
  documentName: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sourceDeleted: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status: 'STREAMING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  errorCode?: string | null;
  followUpActions?: Array<{ label: string; question: string }>;
  createdAt: string;
  citations: Citation[];
}

export interface ConversationDetail {
  id: string;
  title: string;
  documents: Array<{ document: { id: string; originalName: string; status: string } }>;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  documents: Array<{ document: { id: string; originalName: string } }>;
  _count: { messages: number; documents: number };
}

export type ArtifactKind = 'OVERVIEW' | 'FLASHCARDS' | 'QUIZ' | 'COMPARISON' | 'EXTRACTION';
export interface AnalysisArtifact {
  id: string;
  kind: ArtifactKind;
  status: 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED' | 'CANCELLED';
  result: { overview?: string; keyPoints?: Array<{ text: string; documentName: string; pageStart: number | null; pageEnd: number | null }>; suggestedQuestions?: string[]; items?: Array<{ text: string; documentName: string; pageStart: number | null; pageEnd: number | null }>; cards?: Array<{ id: number; front: string; back: string }>; questions?: Array<{ id: number; question: string; options: string[]; correctIndex: number; explanation: string }> } | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  sources: Array<{ document: { id: string; originalName: string } }>;
}

export interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  documentId?: string | null;
  conversationId?: string | null;
}
