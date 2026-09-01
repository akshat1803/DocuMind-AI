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

export const CreateConversationInputSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(10),
});

export const AskQuestionInputSchema = z.object({
  question: z.string().trim().min(1).max(4000),
});

export const RenameConversationInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export type CreateConversationInput = z.infer<typeof CreateConversationInputSchema>;
export type AskQuestionInput = z.infer<typeof AskQuestionInputSchema>;
