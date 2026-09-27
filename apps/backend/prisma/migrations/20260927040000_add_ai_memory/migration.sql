-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('PROFILE', 'GOAL', 'PLAN', 'PREFERENCE', 'CONCERN', 'EVENT', 'DECISION');

-- CreateTable
CREATE TABLE "AiMemory" (
    "id" SERIAL NOT NULL,
    "kind" "MemoryKind" NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 2,
    "sourceMessageId" INTEGER,
    "validUntil" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiMemory_archivedAt_idx" ON "AiMemory"("archivedAt");

