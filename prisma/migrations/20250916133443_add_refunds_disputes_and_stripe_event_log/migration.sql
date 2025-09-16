-- CreateEnum
CREATE TYPE "public"."RefundStatus" AS ENUM ('NONE', 'PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "public"."DisputeStatus" AS ENUM ('NONE', 'OPEN', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "disputeClosedAt" TIMESTAMP(3),
ADD COLUMN     "disputeId" TEXT,
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputeStatus" "public"."DisputeStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "refundIds" TEXT[],
ADD COLUMN     "refundStatus" "public"."RefundStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeChargeId" TEXT;

-- CreateTable
CREATE TABLE "public"."StripeEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bookingId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_eventId_key" ON "public"."StripeEvent"("eventId");
