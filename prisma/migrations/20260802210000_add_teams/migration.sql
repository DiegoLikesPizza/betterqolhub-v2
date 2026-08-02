-- Development teams replace the single `Listing.ownerId`.
--
-- Order matters here and the generated migration had it wrong: Prisma drops
-- ownerId in the same ALTER that adds teamId, which would throw away the only
-- record of who owns what before there is anywhere to put it. So the column is
-- kept until the backfill below has read it, and dropped at the very end.

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');



-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "ListingChangeRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "developer" TEXT,
    "url" TEXT NOT NULL,
    "secondaryUrl" TEXT,
    "pricing" "Pricing",
    "price" TEXT,
    "note" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "ListingChangeRequest_status_createdAt_idx" ON "ListingChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ListingChangeRequest_listingId_idx" ON "ListingChangeRequest"("listingId");

-- CreateIndex
CREATE INDEX "Listing_teamId_idx" ON "Listing"("teamId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingChangeRequest" ADD CONSTRAINT "ListingChangeRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingChangeRequest" ADD CONSTRAINT "ListingChangeRequest_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingChangeRequest" ADD CONSTRAINT "ListingChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every listing that had an owner becomes a one-person team, with that
-- owner as its LEAD. The team is named after the listing, since that is what the
-- people involved actually call it; leads can rename it afterwards.
--
-- A user owning several listings gets one team per listing rather than a merged
-- one. Merging would assert that those listings are maintained by the same
-- group, which is a claim this data cannot support — and splitting a team later
-- is easier than un-merging one.
INSERT INTO "Team" ("id", "name", "createdAt", "updatedAt")
SELECT 'team-' || l."id", l."name", NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC'
FROM "Listing" l
WHERE l."ownerId" IS NOT NULL;

INSERT INTO "TeamMember" ("teamId", "userId", "role", "createdAt")
SELECT 'team-' || l."id", l."ownerId", 'LEAD', NOW() AT TIME ZONE 'UTC'
FROM "Listing" l
WHERE l."ownerId" IS NOT NULL;

UPDATE "Listing" l
SET "teamId" = 'team-' || l."id"
WHERE l."ownerId" IS NOT NULL;

-- Only now, with everything copied across.
ALTER TABLE "Listing" DROP CONSTRAINT "Listing_ownerId_fkey";
DROP INDEX "Listing_ownerId_idx";
ALTER TABLE "Listing" DROP COLUMN "ownerId";
