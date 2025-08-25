-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "billingAddressLine1" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingCompanyName" TEXT,
ADD COLUMN     "billingCountry" TEXT,
ADD COLUMN     "billingIsBusiness" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingPostalCode" TEXT,
ADD COLUMN     "billingTaxId" TEXT,
ADD COLUMN     "operatorSelected" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "insuranceSelected" SET DEFAULT true,
ALTER COLUMN "deliverySelected" SET DEFAULT true,
ALTER COLUMN "pickupSelected" SET DEFAULT true;
