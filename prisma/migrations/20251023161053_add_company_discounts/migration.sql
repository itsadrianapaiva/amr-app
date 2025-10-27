-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "discountPercentage" DECIMAL(65,30) DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."CompanyDiscount" (
    "id" SERIAL NOT NULL,
    "nif" TEXT NOT NULL,
    "discountPercentage" DECIMAL(65,30) NOT NULL,
    "companyName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDiscount_nif_key" ON "public"."CompanyDiscount"("nif");
