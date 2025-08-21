-- AlterTable
ALTER TABLE "public"."Machine" ADD COLUMN     "minDays" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pickupCharge" DECIMAL(65,30),
ALTER COLUMN "deliveryCharge" DROP NOT NULL;
