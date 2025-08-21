-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "deliverySelected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pickupSelected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Machine" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Uncategorized';
