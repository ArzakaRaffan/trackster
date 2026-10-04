-- CreateTable
CREATE TABLE "BudgetSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "rolloverEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BudgetSetting_pkey" PRIMARY KEY ("id")
);
