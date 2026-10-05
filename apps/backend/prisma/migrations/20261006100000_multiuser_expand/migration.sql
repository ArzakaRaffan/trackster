-- Multi-user E1 (expand): HANYA tambah — kolom nullable/default + tabel baru + indeks + FK nullable. Tidak ada DROP/SET NOT NULL/RENAME.
-- Aman untuk kode lama (kolom baru diabaikan). Lihat docs/multi-user/02-Target-Architecture.md §2. Dihasilkan `prisma migrate diff`, ditinjau manual.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OneTimeTokenKind" AS ENUM ('RESET_PASSWORD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Reimbursement" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "DailyBudget" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "BudgetSetting" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "EmailSyncLog" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "EmailParseLog" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "TelegramConfig" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "GmailToken" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "AlertLog" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "IncomeStream" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "BankBalance" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "BalanceAdjustment" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "MerchantAlias" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "CategoryIcon" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "HealthScoreLog" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "BudgetAdvice" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "AiInsightCard" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "PeriodReport" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "AiMemory" ADD COLUMN     "userId" INTEGER;

-- CreateTable
CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "forUsernameHint" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimeToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" "OneTimeTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['INGEST']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundAddress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "localPart" TEXT NOT NULL,
    "gmailSource" TEXT,
    "forwardVerifiedAt" TIMESTAMP(3),
    "lastEmailAt" TIMESTAMP(3),
    "lastForwardCode" TEXT,
    "lastForwardCodeAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shadow" BOOLEAN NOT NULL DEFAULT false,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "source" "Source",
    "label" TEXT,
    "accountNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "chatId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifyEveryTransaction" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkCode" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_codeHash_key" ON "Invite"("codeHash");

-- CreateIndex
CREATE INDEX "Invite_createdByUserId_idx" ON "Invite"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OneTimeToken_tokenHash_key" ON "OneTimeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OneTimeToken_userId_idx" ON "OneTimeToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundAddress_userId_key" ON "InboundAddress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundAddress_localPart_key" ON "InboundAddress"("localPart");

-- CreateIndex
CREATE UNIQUE INDEX "OwnAccount_userId_accountNumber_key" ON "OwnAccount"("userId", "accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_userId_key" ON "TelegramLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_chatId_key" ON "TelegramLink"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkCode_codeHash_key" ON "TelegramLinkCode"("codeHash");

-- CreateIndex
CREATE INDEX "TelegramLinkCode_userId_idx" ON "TelegramLinkCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_userId_dayKey_kind_key" ON "AiUsage"("userId", "dayKey", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Reimbursement_userId_idx" ON "Reimbursement"("userId");

-- CreateIndex
CREATE INDEX "DailyBudget_userId_idx" ON "DailyBudget"("userId");

-- CreateIndex
CREATE INDEX "BudgetSetting_userId_idx" ON "BudgetSetting"("userId");

-- CreateIndex
CREATE INDEX "EmailSyncLog_userId_idx" ON "EmailSyncLog"("userId");

-- CreateIndex
CREATE INDEX "EmailParseLog_userId_idx" ON "EmailParseLog"("userId");

-- CreateIndex
CREATE INDEX "TelegramConfig_userId_idx" ON "TelegramConfig"("userId");

-- CreateIndex
CREATE INDEX "GmailToken_userId_idx" ON "GmailToken"("userId");

-- CreateIndex
CREATE INDEX "AlertLog_userId_idx" ON "AlertLog"("userId");

-- CreateIndex
CREATE INDEX "Income_userId_idx" ON "Income"("userId");

-- CreateIndex
CREATE INDEX "IncomeStream_userId_idx" ON "IncomeStream"("userId");

-- CreateIndex
CREATE INDEX "BankBalance_userId_idx" ON "BankBalance"("userId");

-- CreateIndex
CREATE INDEX "BalanceAdjustment_userId_idx" ON "BalanceAdjustment"("userId");

-- CreateIndex
CREATE INDEX "MerchantAlias_userId_idx" ON "MerchantAlias"("userId");

-- CreateIndex
CREATE INDEX "CategoryIcon_userId_idx" ON "CategoryIcon"("userId");

-- CreateIndex
CREATE INDEX "HealthScoreLog_userId_idx" ON "HealthScoreLog"("userId");

-- CreateIndex
CREATE INDEX "BudgetAdvice_userId_idx" ON "BudgetAdvice"("userId");

-- CreateIndex
CREATE INDEX "AiInsightCard_userId_idx" ON "AiInsightCard"("userId");

-- CreateIndex
CREATE INDEX "PeriodReport_userId_idx" ON "PeriodReport"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "ChatThread_userId_idx" ON "ChatThread"("userId");

-- CreateIndex
CREATE INDEX "AiMemory_userId_idx" ON "AiMemory"("userId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBudget" ADD CONSTRAINT "DailyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetSetting" ADD CONSTRAINT "BudgetSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSyncLog" ADD CONSTRAINT "EmailSyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailParseLog" ADD CONSTRAINT "EmailParseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramConfig" ADD CONSTRAINT "TelegramConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailToken" ADD CONSTRAINT "GmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeStream" ADD CONSTRAINT "IncomeStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalance" ADD CONSTRAINT "BankBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceAdjustment" ADD CONSTRAINT "BalanceAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryIcon" ADD CONSTRAINT "CategoryIcon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScoreLog" ADD CONSTRAINT "HealthScoreLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAdvice" ADD CONSTRAINT "BudgetAdvice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsightCard" ADD CONSTRAINT "AiInsightCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodReport" ADD CONSTRAINT "PeriodReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMemory" ADD CONSTRAINT "AiMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimeToken" ADD CONSTRAINT "OneTimeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundAddress" ADD CONSTRAINT "InboundAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnAccount" ADD CONSTRAINT "OwnAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkCode" ADD CONSTRAINT "TelegramLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

