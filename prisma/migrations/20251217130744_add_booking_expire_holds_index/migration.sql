-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "public"."Booking"("status", "holdExpiresAt");
