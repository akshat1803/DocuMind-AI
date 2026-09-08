CREATE TYPE "ProcessingJobKind" AS ENUM ('INGEST_DOCUMENT', 'GENERATE_OVERVIEW', 'GENERATE_STUDY');
CREATE TYPE "ProcessingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "processing_jobs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "document_id" UUID,
  "kind" "ProcessingJobKind" NOT NULL,
  "status" "ProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "lease_until" TIMESTAMP(3),
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "processing_jobs_status_created_at_idx" ON "processing_jobs"("status", "created_at");
CREATE INDEX "processing_jobs_document_id_status_idx" ON "processing_jobs"("document_id", "status");
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
