-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('RECORDED', 'EXCLUDED', 'UNPARSED', 'DUPLICATE', 'ERROR');

-- CreateTable
CREATE TABLE "EmailParseLog" (
    "id" SERIAL NOT NULL,
    "emailId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "ParseStatus" NOT NULL,
    "reason" TEXT,
    "amount" DECIMAL(12,2),
    "counterparty" TEXT,
    "kind" TEXT,
    "parser" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailParseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailParseLog_emailId_key" ON "EmailParseLog"("emailId");

-- CreateIndex
CREATE INDEX "EmailParseLog_status_idx" ON "EmailParseLog"("status");

-- CreateIndex
CREATE INDEX "EmailParseLog_receivedAt_idx" ON "EmailParseLog"("receivedAt");
