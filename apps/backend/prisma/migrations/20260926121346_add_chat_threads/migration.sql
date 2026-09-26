-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('WEB', 'TELEGRAM');

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "channel" "ChatChannel" NOT NULL DEFAULT 'WEB',
    "summary" TEXT,
    "summaryUpToId" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "toolCalls" JSONB,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatThread_channel_idx" ON "ChatThread"("channel");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_id_idx" ON "ChatMessage"("threadId", "id");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
