-- CreateEnum
CREATE TYPE "IncomeKind" AS ENUM ('FIXED', 'SESSION', 'DEDUCTION', 'VARIABLE', 'IRREGULAR');

-- CreateEnum
CREATE TYPE "IncomeCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'NONE');

-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('CONFIRMED', 'PENDING', 'INTERNAL');

-- CreateEnum
CREATE TYPE "IncomeOrigin" AS ENUM ('MANUAL', 'CHECKIN', 'EMAIL', 'NOTIFICATION');

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "extraUnits" DECIMAL(4,1),
ADD COLUMN     "origin" "IncomeOrigin" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "periodStart" DATE,
ADD COLUMN     "status" "IncomeStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "streamId" INTEGER,
ADD COLUMN     "units" DECIMAL(4,1);

-- CreateTable
CREATE TABLE "IncomeStream" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "IncomeKind" NOT NULL,
    "cadence" "IncomeCadence" NOT NULL,
    "source" "Source" NOT NULL,
    "payDayOfWeek" INTEGER,
    "payDayOfMonth" INTEGER,
    "amount" DECIMAL(12,2),
    "sessionRate" DECIMAL(12,2),
    "sessionExtra" DECIMAL(12,2),
    "maxUnits" INTEGER,
    "deductionPerUnit" DECIMAL(12,2),
    "typicalUnits" DECIMAL(4,1),
    "matchKeywords" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Income_externalId_key" ON "Income"("externalId");

-- CreateIndex
CREATE INDEX "Income_streamId_periodStart_idx" ON "Income"("streamId", "periodStart");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "IncomeStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

