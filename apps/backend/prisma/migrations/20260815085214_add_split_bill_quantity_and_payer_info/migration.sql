-- AlterTable
ALTER TABLE "SplitBill" ADD COLUMN     "payerAccountName" TEXT,
ADD COLUMN     "payerAccountNumber" TEXT,
ADD COLUMN     "payerBankName" TEXT;

-- AlterTable
ALTER TABLE "SplitBillItem" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;
