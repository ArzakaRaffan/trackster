CREATE TABLE "SplitBillReceipt" (
    "splitBillId" INTEGER NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "SplitBillReceipt_pkey" PRIMARY KEY ("splitBillId")
);

ALTER TABLE "SplitBillReceipt" ADD CONSTRAINT "SplitBillReceipt_splitBillId_fkey" FOREIGN KEY ("splitBillId") REFERENCES "SplitBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
