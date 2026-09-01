CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "MessageStatus" AS ENUM ('STREAMING', 'COMPLETED', 'FAILED');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "original_name" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "storage_provider" TEXT NOT NULL DEFAULT 'cloudinary',
  "storage_asset_id" TEXT,
  "storage_resource_type" TEXT NOT NULL DEFAULT 'image',
  "storage_delivery_type" TEXT NOT NULL DEFAULT 'authenticated',
  "mime_type" TEXT NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "page_count" INTEGER,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_chunks" (
  "id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "page_start" INTEGER,
  "page_end" INTEGER,
  "token_count" INTEGER NOT NULL,
  "embedding" vector(768),
  "content_hash" TEXT NOT NULL,
  CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_documents" (
  "conversation_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  CONSTRAINT "conversation_documents_pkey" PRIMARY KEY ("conversation_id", "document_id")
);

CREATE TABLE "messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "role" "MessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'COMPLETED',
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "latency_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_citations" (
  "id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "chunk_id" UUID NOT NULL,
  "citation_number" INTEGER NOT NULL,
  "excerpt" TEXT NOT NULL,
  "similarity_score" DECIMAL(5,4),
  CONSTRAINT "message_citations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "documents_user_id_status_idx" ON "documents"("user_id", "status");
CREATE UNIQUE INDEX "documents_storage_provider_storage_key_key" ON "documents"("storage_provider", "storage_key");
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks"("document_id");
CREATE INDEX "document_chunks_content_hash_idx" ON "document_chunks"("content_hash");
CREATE UNIQUE INDEX "document_chunks_document_id_chunk_index_key" ON "document_chunks"("document_id", "chunk_index");
CREATE INDEX "document_chunks_embedding_hnsw_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops) WHERE "embedding" IS NOT NULL;
CREATE INDEX "conversations_user_id_updated_at_idx" ON "conversations"("user_id", "updated_at");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX "message_citations_chunk_id_idx" ON "message_citations"("chunk_id");
CREATE UNIQUE INDEX "message_citations_message_id_citation_number_key" ON "message_citations"("message_id", "citation_number");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_documents" ADD CONSTRAINT "conversation_documents_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_documents" ADD CONSTRAINT "conversation_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
