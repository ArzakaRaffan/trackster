-- AlterTable
ALTER TABLE "SplitBill" ALTER COLUMN "createdByUserId" DROP NOT NULL,
ADD COLUMN     "ownerToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SplitBill_ownerToken_key" ON "SplitBill"("ownerToken");
