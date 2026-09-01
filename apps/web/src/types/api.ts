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
  chunkId: string;
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status: 'STREAMING' | 'COMPLETED' | 'FAILED';
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
  _count: { messages: number; documents: number };
}
