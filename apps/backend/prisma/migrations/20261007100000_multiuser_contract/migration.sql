-- Multi-user C1 (contract): userId NOT NULL di 23 tabel tenant + unik global -> komposit (userId, ...) + PK CategoryIcon komposit.
-- Disusun dari `prisma migrate diff` MINUS drift raw-SQL lama (indeks tsvector/trgm ChatMessage_search_idx & Transaction_description_trgm_idx
-- + ChatMessage.search DEFAULT) yang sengaja tidak disentuh.
-- Langkah 1 mengulang backfill E2 (idempoten) supaya baris yang dibuat kode lama sesudah E2 tidak menggagalkan SET NOT NULL
-- (satu-satunya user saat ini = pemilik; produk single-user sampai migrasi ini). WAJIB backup DB sebelum deploy (docs/multi-user/06-Runbooks.md).

UPDATE "Transaction" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "Reimbursement" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "DailyBudget" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "BudgetSetting" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "EmailSyncLog" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "EmailParseLog" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "TelegramConfig" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "GmailToken" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "AlertLog" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "Income" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "IncomeStream" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "BankBalance" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "BalanceAdjustment" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "MerchantAlias" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "CategoryIcon" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "HealthScoreLog" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "BudgetAdvice" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "AiInsightCard" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "PeriodReport" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "Goal" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "Subscription" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "ChatThread" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");
UPDATE "AiMemory" SET "userId" = (SELECT MIN("id") FROM "User") WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User");

-- DropIndex
DROP INDEX "AiInsightCard_rangeKey_dayKey_key";

-- DropIndex
DROP INDEX "AlertLog_date_key";

-- DropIndex
DROP INDEX "BankBalance_source_key";

-- DropIndex
DROP INDEX "BudgetAdvice_weekStart_key";

-- DropIndex
DROP INDEX "DailyBudget_dayOfWeek_key";

-- DropIndex
DROP INDEX "EmailParseLog_emailId_key";

-- DropIndex
DROP INDEX "HealthScoreLog_weekStart_key";

-- DropIndex
DROP INDEX "Income_externalId_key";

-- DropIndex
DROP INDEX "MerchantAlias_rawDescription_key";

-- DropIndex
DROP INDEX "PeriodReport_period_periodStart_key";

-- DropIndex
DROP INDEX "Transaction_emailId_key";

-- AlterTable
ALTER TABLE "AiInsightCard" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AiMemory" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AlertLog" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BalanceAdjustment" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BankBalance" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BudgetAdvice" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BudgetSetting" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CategoryIcon" DROP CONSTRAINT "CategoryIcon_pkey",
ALTER COLUMN "userId" SET NOT NULL,
ADD CONSTRAINT "CategoryIcon_pkey" PRIMARY KEY ("userId", "category");

-- AlterTable
ALTER TABLE "ChatThread" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DailyBudget" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "EmailParseLog" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "EmailSyncLog" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "GmailToken" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "HealthScoreLog" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Income" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "IncomeStream" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MerchantAlias" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PeriodReport" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Reimbursement" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TelegramConfig" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AiInsightCard_userId_rangeKey_dayKey_key" ON "AiInsightCard"("userId", "rangeKey", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "AlertLog_userId_date_key" ON "AlertLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BankBalance_userId_source_key" ON "BankBalance"("userId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAdvice_userId_weekStart_key" ON "BudgetAdvice"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetSetting_userId_key" ON "BudgetSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyBudget_userId_dayOfWeek_key" ON "DailyBudget"("userId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "EmailParseLog_userId_emailId_key" ON "EmailParseLog"("userId", "emailId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScoreLog_userId_weekStart_key" ON "HealthScoreLog"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Income_userId_externalId_key" ON "Income"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAlias_userId_rawDescription_key" ON "MerchantAlias"("userId", "rawDescription");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodReport_userId_period_periodStart_key" ON "PeriodReport"("userId", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_emailId_key" ON "Transaction"("userId", "emailId");

