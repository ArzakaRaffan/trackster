-- CreateEnum
CREATE TYPE "BudgetMode" AS ENUM ('FIXED', 'CYCLE', 'BALANCE');

-- AlterTable
ALTER TABLE "BudgetSetting" ADD COLUMN     "anchorStreamId" INTEGER,
ADD COLUMN     "horizonDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "mode" "BudgetMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "reservePct" INTEGER NOT NULL DEFAULT 10;

-- AddForeignKey
ALTER TABLE "BudgetSetting" ADD CONSTRAINT "BudgetSetting_anchorStreamId_fkey" FOREIGN KEY ("anchorStreamId") REFERENCES "IncomeStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

