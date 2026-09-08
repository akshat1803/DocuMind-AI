ALTER TYPE "MessageStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "messages" ADD COLUMN "request_id" UUID, ADD COLUMN "reply_to_id" UUID, ADD COLUMN "error_code" TEXT;
CREATE UNIQUE INDEX "messages_request_id_key" ON "messages"("request_id");
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "messages" a SET "reply_to_id" = (
  SELECT u.id FROM "messages" u WHERE u.conversation_id = a.conversation_id AND u.role = 'USER' AND u.created_at <= a.created_at ORDER BY u.created_at DESC, u.id DESC LIMIT 1
) WHERE a.role = 'ASSISTANT';
ALTER TABLE "message_citations" ALTER COLUMN "chunk_id" DROP NOT NULL;
ALTER TABLE "message_citations" DROP CONSTRAINT "message_citations_chunk_id_fkey";
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message_citations" ADD COLUMN "document_name" TEXT, ADD COLUMN "page_start" INTEGER, ADD COLUMN "page_end" INTEGER, ADD COLUMN "source_deleted" BOOLEAN NOT NULL DEFAULT false;
UPDATE "message_citations" c SET document_name = d.original_name, page_start = ch.page_start, page_end = ch.page_end FROM document_chunks ch JOIN documents d ON d.id = ch.document_id WHERE c.chunk_id = ch.id;
