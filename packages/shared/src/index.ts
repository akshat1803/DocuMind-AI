import { z } from 'zod';

export const RegisterInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const DocumentSelectionSchema = z.array(z.string().uuid()).min(1).max(10);

export const CreateConversationInputSchema = z.object({
  documentIds: DocumentSelectionSchema,
});

export const AskQuestionInputSchema = z.object({
  question: z.string().trim().min(1).max(4000),
  requestId: z.string().uuid().optional(),
  retryMessageId: z.string().uuid().optional(),
});

export const RenameConversationInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const ArtifactRequestSchema = z.object({
  kind: z.enum(['OVERVIEW', 'FLASHCARDS', 'QUIZ', 'COMPARISON', 'EXTRACTION']),
  documentIds: DocumentSelectionSchema,
  configuration: z.record(z.unknown()).default({}),
});
export const NoteInputSchema = z.object({ documentId: z.string().uuid().optional(), conversationId: z.string().uuid().optional(), content: z.string().trim().min(1).max(50_000) });
export const BookmarkInputSchema = z.object({ messageId: z.string().uuid().optional(), label: z.string().trim().max(120).optional() });
export const QuizAttemptInputSchema = z.object({ score: z.number().int().min(0).max(100), answers: z.record(z.number().int().min(0).max(3)) });

export type CreateConversationInput = z.infer<typeof CreateConversationInputSchema>;
export type AskQuestionInput = z.infer<typeof AskQuestionInputSchema>;
