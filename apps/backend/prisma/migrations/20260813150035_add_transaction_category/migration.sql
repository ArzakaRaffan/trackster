-- CreateEnum
CREATE TYPE "Category" AS ENUM ('MAKANAN', 'TRANSPORT', 'BELANJA', 'TAGIHAN', 'HIBURAN', 'KESEHATAN', 'LAINNYA');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'LAINNYA';
