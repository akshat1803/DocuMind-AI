import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the monorepo root first, then fall back to current directory
const monorepoRootEnv = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: monorepoRootEnv });
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL environment variable is required',
  }),
  JWT_ACCESS_SECRET: z.string().default('develop_only_jwt_access_secret_change_me_in_prod'),
  JWT_REFRESH_SECRET: z.string().default('develop_only_jwt_refresh_secret_change_me_in_prod'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  GEMINI_API_KEY: z.string({
    required_error: 'GEMINI_API_KEY environment variable is required',
  }),
  GEMINI_CHAT_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-2'),
  STORAGE_DIR: z.string().default('.uploads'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  MAX_FILE_SIZE_MB: z.coerce.number().default(20),
  MAX_DOCUMENTS_PER_USER: z.coerce.number().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
