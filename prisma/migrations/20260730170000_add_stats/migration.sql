-- CreateTable
CREATE TABLE "ListingStat" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ListingStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageStat" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingStat_day_idx" ON "ListingStat"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ListingStat_listingId_day_key" ON "ListingStat"("listingId", "day");

-- CreateIndex
CREATE INDEX "PageStat_day_idx" ON "PageStat"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PageStat_path_day_key" ON "PageStat"("path", "day");

-- AddForeignKey
ALTER TABLE "ListingStat" ADD CONSTRAINT "ListingStat_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
