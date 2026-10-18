-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "balanceApplied" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "balanceApplied" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: baris yang tidak (lagi) ikut di saldo = ada koreksi manual (BalanceAdjustment) sesudahnya — entah dilewati aturan
-- baseline saat dibuat (koreksi > occurredAt), entah diserap koreksi sesudahnya. Entri manual web selalu menggerakkan saldo
-- saat dibuat, jadi untuk mereka yang dihitung koreksi sesudah createdAt.
UPDATE "Transaction" t SET "balanceApplied" = false
WHERE EXISTS (
  SELECT 1 FROM "BalanceAdjustment" a
  WHERE a."userId" = t."userId" AND a."source" = t."source"
    AND a."createdAt" > CASE WHEN t."isManual" THEN t."createdAt" ELSE t."occurredAt" END
);

UPDATE "Income" i SET "balanceApplied" = false
WHERE EXISTS (
  SELECT 1 FROM "BalanceAdjustment" a
  WHERE a."userId" = i."userId" AND a."source" = i."source"
    AND a."createdAt" > CASE WHEN i."origin" = 'MANUAL' AND i."externalId" IS NULL THEN i."createdAt" ELSE i."receivedAt" END
);

UPDATE "Reimbursement" r SET "balanceApplied" = false
WHERE r."balanceApplied" AND EXISTS (
  SELECT 1 FROM "BalanceAdjustment" a
  WHERE a."userId" = r."userId" AND a."source" = r."receivedSource" AND a."createdAt" > r."receivedAt"
);
