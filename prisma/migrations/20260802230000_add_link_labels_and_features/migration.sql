-- AlterTable
ALTER TABLE "ListingChangeRequest" ADD COLUMN     "features" TEXT,
ADD COLUMN     "secondaryUrlLabel" TEXT,
ADD COLUMN     "urlLabel" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "features" TEXT,
ADD COLUMN     "secondaryUrlLabel" TEXT,
ADD COLUMN     "urlLabel" TEXT;

