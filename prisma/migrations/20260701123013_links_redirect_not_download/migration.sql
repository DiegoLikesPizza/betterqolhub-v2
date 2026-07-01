/*
  Warnings:

  - You are about to drop the column `downloadUrl` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `sourceUrl` on the `Listing` table. All the data in the column will be lost.
  - Added the required column `url` to the `Listing` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "developer" TEXT,
    "url" TEXT NOT NULL,
    "secondaryUrl" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Listing" ("category", "createdAt", "description", "developer", "id", "isTrusted", "name", "updatedAt") SELECT "category", "createdAt", "description", "developer", "id", "isTrusted", "name", "updatedAt" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
