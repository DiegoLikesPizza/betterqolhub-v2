-- CreateEnum
CREATE TYPE "Pricing" AS ENUM ('FREE', 'PAID', 'FREEMIUM');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "pricing" "Pricing";

