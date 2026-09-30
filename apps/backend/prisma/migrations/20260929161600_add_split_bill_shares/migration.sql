ALTER TABLE "SplitBill" ADD COLUMN "taxPercent" DECIMAL(5,2);
ALTER TABLE "SplitBill" ADD COLUMN "servicePercent" DECIMAL(5,2);
ALTER TABLE "SplitBill" ADD COLUMN "discountAmount" DECIMAL(12,2);
ALTER TABLE "SplitBill" ADD COLUMN "discountPercent" DECIMAL(5,2);
ALTER TABLE "SplitBill" ADD COLUMN "deliveryFee" DECIMAL(12,2);
ALTER TABLE "SplitBill" ADD COLUMN "roundingUnit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SplitBill" ADD COLUMN "taxAfterService" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SplitBillItemShare" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "participantId" INTEGER NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,

    CONSTRAINT "SplitBillItemShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SplitBillItemShare_itemId_participantId_key" ON "SplitBillItemShare"("itemId", "participantId");

ALTER TABLE "SplitBillItemShare" ADD CONSTRAINT "SplitBillItemShare_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SplitBillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SplitBillItemShare" ADD CONSTRAINT "SplitBillItemShare_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SplitBillParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SplitBillItemShare" ("itemId", "participantId", "weight")
SELECT "id", "participantId", 1 FROM "SplitBillItem" WHERE "participantId" IS NOT NULL;
