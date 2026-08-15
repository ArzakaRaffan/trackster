-- CreateTable
CREATE TABLE "SplitBill" (
    "id" SERIAL NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "serviceFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitBillParticipant" (
    "id" SERIAL NOT NULL,
    "splitBillId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SplitBillParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitBillItem" (
    "id" SERIAL NOT NULL,
    "splitBillId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "participantId" INTEGER,

    CONSTRAINT "SplitBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SplitBill_publicSlug_key" ON "SplitBill"("publicSlug");

-- CreateIndex
CREATE INDEX "SplitBillParticipant_splitBillId_idx" ON "SplitBillParticipant"("splitBillId");

-- CreateIndex
CREATE INDEX "SplitBillItem_splitBillId_idx" ON "SplitBillItem"("splitBillId");

-- CreateIndex
CREATE INDEX "SplitBillItem_participantId_idx" ON "SplitBillItem"("participantId");

-- AddForeignKey
ALTER TABLE "SplitBillParticipant" ADD CONSTRAINT "SplitBillParticipant_splitBillId_fkey" FOREIGN KEY ("splitBillId") REFERENCES "SplitBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitBillItem" ADD CONSTRAINT "SplitBillItem_splitBillId_fkey" FOREIGN KEY ("splitBillId") REFERENCES "SplitBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitBillItem" ADD CONSTRAINT "SplitBillItem_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SplitBillParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
