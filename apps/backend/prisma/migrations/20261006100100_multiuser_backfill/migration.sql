-- Multi-user E2 (backfill): semua baris tenant lama -> user pertama (Arzaka; produk ini sampai sekarang single-user).
-- IDEMPOTEN (hanya baris userId IS NULL) dan AMAN di DB kosong/tanpa user (no-op, tidak pernah RAISE -> tidak bisa menjatuhkan container saat `migrate deploy`).
-- Data pribadi (nama lengkap, rekening, Telegram) sengaja TIDAK di sini (repo publik): lihat prisma/data-fixes/2026-10-multiuser-backfill-owner.js.
-- Baris yang dibuat kode LAMA setelah migrasi ini (userId NULL) diisi ulang oleh skrip itu sebelum langkah contract (C1).

UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = (SELECT MIN("id") FROM "User");

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
