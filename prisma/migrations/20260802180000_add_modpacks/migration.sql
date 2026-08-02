-- CreateEnum
CREATE TYPE "ModpackFileKind" AS ENUM ('MRPACK', 'ZIP');

-- CreateTable
CREATE TABLE "Modpack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "minecraft" TEXT NOT NULL,
    "loader" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Modpack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModpackFile" (
    "id" TEXT NOT NULL,
    "modpackId" TEXT NOT NULL,
    "kind" "ModpackFileKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModpackFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModpackMod" (
    "id" TEXT NOT NULL,
    "modpackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modrinth" TEXT,
    "bundledOnly" BOOLEAN NOT NULL DEFAULT false,
    "group" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ModpackMod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Modpack_slug_key" ON "Modpack"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModpackFile_modpackId_kind_key" ON "ModpackFile"("modpackId", "kind");

-- CreateIndex
CREATE INDEX "ModpackMod_modpackId_idx" ON "ModpackMod"("modpackId");

-- AddForeignKey
ALTER TABLE "ModpackFile" ADD CONSTRAINT "ModpackFile_modpackId_fkey" FOREIGN KEY ("modpackId") REFERENCES "Modpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModpackMod" ADD CONSTRAINT "ModpackMod_modpackId_fkey" FOREIGN KEY ("modpackId") REFERENCES "Modpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

