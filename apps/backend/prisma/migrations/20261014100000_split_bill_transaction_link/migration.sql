-- Split bill (akun) dapat ditautkan ke satu transaksi; peserta tertaut ke satu Reimbursement. Aditif & nullable.
ALTER TABLE "SplitBill" ADD COLUMN "transactionId" INTEGER;
ALTER TABLE "Reimbursement" ADD COLUMN "splitParticipantId" INTEGER;

CREATE UNIQUE INDEX "SplitBill_transactionId_key" ON "SplitBill"("transactionId");
CREATE UNIQUE INDEX "Reimbursement_splitParticipantId_key" ON "Reimbursement"("splitParticipantId");

ALTER TABLE "SplitBill" ADD CONSTRAINT "SplitBill_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitBillParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
