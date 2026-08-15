-- Add quantity to split bill items (default 1)
ALTER TABLE "SplitBillItem"
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- Add payer bank info columns to split bills
ALTER TABLE "SplitBill"
ADD COLUMN "payerName" TEXT,
ADD COLUMN "payerBank" TEXT,
ADD COLUMN "payerAccountNumber" TEXT,
ADD COLUMN "payerContact" TEXT;
