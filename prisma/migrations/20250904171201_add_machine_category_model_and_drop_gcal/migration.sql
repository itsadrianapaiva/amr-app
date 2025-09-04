/*
  Warnings:

  - You are about to drop the column `googleCalendarEventId` on the `Booking` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[authorizedPaymentIntentId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Booking" DROP COLUMN "googleCalendarEventId",
ADD COLUMN     "authorizedAmount" DECIMAL(65,30),
ADD COLUMN     "authorizedPaymentIntentId" TEXT,
ALTER COLUMN "holdExpiresAt" SET DATA TYPE TIMESTAMP(6);

-- AlterTable
ALTER TABLE "public"."Machine" ADD COLUMN     "model" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_authorizedPaymentIntentId_key" ON "public"."Booking"("authorizedPaymentIntentId");
