-- CreateEnum
CREATE TYPE "ReportPeriod" AS ENUM ('WEEK', 'MONTH');

-- CreateTable
CREATE TABLE "PeriodReport" (
    "id" SERIAL NOT NULL,
    "period" "ReportPeriod" NOT NULL,
    "periodStart" DATE NOT NULL,
    "stats" JSONB NOT NULL,
    "narrative" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodReport_period_periodStart_key" ON "PeriodReport"("period", "periodStart");
