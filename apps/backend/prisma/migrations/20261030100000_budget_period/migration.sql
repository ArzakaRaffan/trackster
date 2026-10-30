-- Budget periode (docs/budget-kebiasaan.md). Aditif saja: tidak ada UPDATE data.
-- period NULL = setelan lama, diturunkan on-the-fly oleh BudgetService.getSettings().

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "BudgetBasis" AS ENUM ('INCOME', 'TARGET');

-- AlterTable
ALTER TABLE "BudgetSetting" ADD COLUMN     "autoWeights" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "basis" "BudgetBasis" NOT NULL DEFAULT 'INCOME',
ADD COLUMN     "period" "BudgetPeriod",
ADD COLUMN     "periodDay" INTEGER,
ADD COLUMN     "targetAmount" DECIMAL(12,2);
