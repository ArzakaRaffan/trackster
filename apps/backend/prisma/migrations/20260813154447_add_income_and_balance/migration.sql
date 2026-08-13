-- CreateTable
CREATE TABLE "Income" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBalance" (
    "id" SERIAL NOT NULL,
    "source" "Source" NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceAdjustment" (
    "id" SERIAL NOT NULL,
    "source" "Source" NOT NULL,
    "delta" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Income_receivedAt_idx" ON "Income"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankBalance_source_key" ON "BankBalance"("source");

-- CreateIndex
CREATE INDEX "BalanceAdjustment_source_idx" ON "BalanceAdjustment"("source");
