-- CreateTable
CREATE TABLE "MerchantAlias" (
    "id" SERIAL NOT NULL,
    "rawDescription" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAlias_rawDescription_key" ON "MerchantAlias"("rawDescription");
