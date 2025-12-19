-- CreateTable
CREATE TABLE "public"."BookingJob" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BookingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingJob_status_createdAt_idx" ON "public"."BookingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BookingJob_bookingId_type_idx" ON "public"."BookingJob"("bookingId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "BookingJob_bookingId_type_key" ON "public"."BookingJob"("bookingId", "type");

-- AddForeignKey
ALTER TABLE "public"."BookingJob" ADD CONSTRAINT "BookingJob_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
