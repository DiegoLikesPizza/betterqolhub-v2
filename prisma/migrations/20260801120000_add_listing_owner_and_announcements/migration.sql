-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_listingId_createdAt_idx" ON "Announcement"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_ownerId_idx" ON "Listing"("ownerId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

