-- Query per user hampir selalu memfilter rentang waktu (budget harian, laporan, analisis, log email).
-- Indeks komposit menggantikan indeks userId tunggal (lookup userId saja tetap tertutup kolom pertama
-- indeks ini dan unik (userId, emailId)/(userId, externalId)). Aditif + drop indeks, tanpa ubah data.

-- CreateIndex
CREATE INDEX "Transaction_userId_occurredAt_idx" ON "Transaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailParseLog_userId_receivedAt_idx" ON "EmailParseLog"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "Income_userId_receivedAt_idx" ON "Income"("userId", "receivedAt");

-- DropIndex
DROP INDEX "Transaction_userId_idx";

-- DropIndex
DROP INDEX "EmailParseLog_userId_idx";

-- DropIndex
DROP INDEX "Income_userId_idx";
