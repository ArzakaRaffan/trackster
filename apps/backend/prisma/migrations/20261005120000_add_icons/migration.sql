-- AlterTable
ALTER TABLE "MerchantAlias" ADD COLUMN "icon" TEXT;

-- CreateTable
CREATE TABLE "CategoryIcon" (
    "category" "Category" NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "CategoryIcon_pkey" PRIMARY KEY ("category")
);
