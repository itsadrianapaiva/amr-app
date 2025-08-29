-- Enable equality support for GiST over integers (needed for machineId WITH =)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Safety: start must be <= end
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_start_before_end"
  CHECK ("startDate" <= "endDate");

-- Derived, immutable range from your timestamps; inclusive on both ends ([start,end])
-- Prisma DateTime maps to PostgreSQL 'timestamp' (without timezone) -> use tsrange
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "during" tsrange
  GENERATED ALWAYS AS (tsrange("startDate", "endDate", '[]')) STORED;

-- Prevent any overlap for the same machine when status is PENDING or CONFIRMED.
-- '&&' is the "overlaps" operator for range types.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap_for_active"
  EXCLUDE USING gist (
    "machineId" WITH =,
    "during"    WITH &&
  )
  WHERE ("status" IN ('PENDING'::"BookingStatus", 'CONFIRMED'::"BookingStatus"));
