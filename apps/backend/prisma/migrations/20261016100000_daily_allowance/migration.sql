-- CreateTable
CREATE TABLE "DailyAllowance" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "DailyAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyAllowance_userId_date_key" ON "DailyAllowance"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyAllowance" ADD CONSTRAINT "DailyAllowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

