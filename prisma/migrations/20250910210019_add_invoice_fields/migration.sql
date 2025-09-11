/*
  Warnings:

  - A unique constraint covering the columns `[invoiceProvider,invoiceProviderId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "invoiceAtcud" TEXT,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "invoicePdfUrl" TEXT,
ADD COLUMN     "invoiceProvider" TEXT,
ADD COLUMN     "invoiceProviderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_invoiceProvider_invoiceProviderId_key" ON "public"."Booking"("invoiceProvider", "invoiceProviderId");
