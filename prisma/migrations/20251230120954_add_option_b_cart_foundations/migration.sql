-- CreateEnum
CREATE TYPE "public"."MachineItemType" AS ENUM ('PRIMARY', 'ADDON');

-- CreateEnum
CREATE TYPE "public"."ChargeModel" AS ENUM ('PER_BOOKING', 'PER_UNIT');

-- CreateEnum
CREATE TYPE "public"."TimeUnit" AS ENUM ('DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "public"."BookingDurationUnit" AS ENUM ('DAY', 'HOUR');

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "durationUnit" "public"."BookingDurationUnit" NOT NULL DEFAULT 'DAY',
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "startAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Machine" ADD COLUMN     "chargeModel" "public"."ChargeModel" NOT NULL DEFAULT 'PER_BOOKING',
ADD COLUMN     "itemType" "public"."MachineItemType" NOT NULL DEFAULT 'PRIMARY',
ADD COLUMN     "timeUnit" "public"."TimeUnit" NOT NULL DEFAULT 'DAY';

-- CreateTable
CREATE TABLE "public"."BookingItem" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemType" "public"."MachineItemType" NOT NULL DEFAULT 'PRIMARY',
    "chargeModel" "public"."ChargeModel" NOT NULL DEFAULT 'PER_BOOKING',
    "timeUnit" "public"."TimeUnit" NOT NULL DEFAULT 'DAY',
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "public"."BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingItem_machineId_idx" ON "public"."BookingItem"("machineId");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_isPrimary_idx" ON "public"."BookingItem"("bookingId", "isPrimary");

-- AddForeignKey
ALTER TABLE "public"."BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingItem" ADD CONSTRAINT "BookingItem_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "public"."Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- BACKFILL: Option B Slice 1 - populate new fields for existing bookings
-- ============================================================================

-- Step A: Backfill Booking.startAt and Booking.endAt from existing startDate/endDate
-- Only update rows where startAt or endAt is NULL (idempotent)
UPDATE "public"."Booking"
SET
  "startAt" = "startDate",
  "endAt" = "endDate"
WHERE "startAt" IS NULL OR "endAt" IS NULL;

-- Step B: Backfill BookingItem for existing bookings
-- Create exactly one BookingItem per existing Booking with isPrimary=true
-- Only insert if no BookingItem exists yet for that booking (idempotent via NOT EXISTS)
INSERT INTO "public"."BookingItem" (
  "bookingId",
  "machineId",
  "quantity",
  "itemType",
  "chargeModel",
  "timeUnit",
  "unitPrice",
  "isPrimary",
  "createdAt",
  "updatedAt"
)
SELECT
  b.id AS "bookingId",
  b."machineId",
  1 AS "quantity",
  'PRIMARY'::"public"."MachineItemType" AS "itemType",
  'PER_BOOKING'::"public"."ChargeModel" AS "chargeModel",
  'DAY'::"public"."TimeUnit" AS "timeUnit",
  m."dailyRate" AS "unitPrice",
  true AS "isPrimary",
  b."createdAt" AS "createdAt",
  NOW() AS "updatedAt"
FROM "public"."Booking" b
INNER JOIN "public"."Machine" m ON b."machineId" = m.id
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."BookingItem" bi
  WHERE bi."bookingId" = b.id
);
