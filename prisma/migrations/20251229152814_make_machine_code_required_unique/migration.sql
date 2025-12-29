/*
  Warnings:

  - Made the column `code` on table `Machine` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Machine" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");
