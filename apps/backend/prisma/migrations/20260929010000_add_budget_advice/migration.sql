-- CreateTable
CREATE TABLE "BudgetAdvice" (
    "id" SERIAL NOT NULL,
    "weekStart" DATE NOT NULL,
    "recommended" TEXT NOT NULL,
    "reason" TEXT,
    "tip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetAdvice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAdvice_weekStart_key" ON "BudgetAdvice"("weekStart");
