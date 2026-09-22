-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "nextDueDate" DATE NOT NULL,
    "source" "Source",
    "notes" TEXT,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "googleCalendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_nextDueDate_idx" ON "Subscription"("nextDueDate");

-- CreateIndex
CREATE INDEX "Subscription_isActive_idx" ON "Subscription"("isActive");