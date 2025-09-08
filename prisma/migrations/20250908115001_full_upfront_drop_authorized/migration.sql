/*
  Warnings:

  - You are about to drop the column `authorizedAmount` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `authorizedPaymentIntentId` on the `Booking` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Booking_authorizedPaymentIntentId_key";

-- AlterTable
ALTER TABLE "public"."Booking" DROP COLUMN "authorizedAmount",
DROP COLUMN "authorizedPaymentIntentId";
