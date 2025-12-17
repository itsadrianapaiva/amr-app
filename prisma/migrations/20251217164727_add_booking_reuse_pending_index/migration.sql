-- CreateIndex
CREATE INDEX "Booking_machineId_status_startDate_endDate_customerEmail_idx" ON "public"."Booking"("machineId", "status", "startDate", "endDate", "customerEmail");
