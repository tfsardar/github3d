/*
  Warnings:

  - Added the required column `year` to the `contribution_snapshots` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "contribution_snapshots_userId_fetchedAt_idx";

-- AlterTable
ALTER TABLE "contribution_snapshots" ADD COLUMN     "year" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "contribution_snapshots_userId_year_fetchedAt_idx" ON "contribution_snapshots"("userId", "year", "fetchedAt");
