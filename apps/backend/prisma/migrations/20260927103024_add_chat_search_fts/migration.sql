-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (to_tsvector('indonesian', coalesce("content", ''))) STORED;

-- CreateIndex
CREATE INDEX "ChatMessage_search_idx" ON "ChatMessage" USING GIN ("search");

-- Trigram search (merchant typo tolerance untuk searchTransactions, E04-S4)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Transaction_description_trgm_idx" ON "Transaction" USING GIN ("description" gin_trgm_ops);
