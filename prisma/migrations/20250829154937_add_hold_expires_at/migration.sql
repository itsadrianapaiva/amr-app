-- 1) Add an optional expiry timestamp for PENDING holds.
--    We keep it nullable so ops-created CONFIRMED rows don’t need a value.
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "holdExpiresAt" timestamp;

-- 2) Speed up cleanup: index only PENDING rows with a hold expiry.
--    Partial index keeps it small and fast.
CREATE INDEX IF NOT EXISTS "booking_pending_expiry_idx"
  ON "Booking" ("holdExpiresAt")
  WHERE ("status" = 'PENDING'::"BookingStatus");
