-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Category" ADD VALUE 'TRANSFER';
ALTER TYPE "Category" ADD VALUE 'TOPUP';
ALTER TYPE "Category" ADD VALUE 'PENDIDIKAN';
ALTER TYPE "Category" ADD VALUE 'PERAWATAN';
ALTER TYPE "Category" ADD VALUE 'INVESTASI';
ALTER TYPE "Category" ADD VALUE 'ROKOK';

-- AlterTable
ALTER TABLE "MerchantAlias" ADD COLUMN     "category" "Category",
ALTER COLUMN "displayName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "merchantKey" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_merchantKey_idx" ON "Transaction"("merchantKey");
