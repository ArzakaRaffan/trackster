-- AlterTable
ALTER TABLE "TelegramConfig" ADD COLUMN     "dailyBrief" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TelegramLink" ADD COLUMN     "dailyBrief" BOOLEAN NOT NULL DEFAULT false;

