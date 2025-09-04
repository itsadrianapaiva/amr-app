/**
 * Thin adapter to persist or reuse a PENDING booking.
 * Keeps the action file small and makes it easy to mock in tests.
 */

import {
  createOrReusePendingBooking,
  type PendingBookingDTO,
} from "@/lib/repos/booking-repo";

/**
 * persistPendingBooking
 * Delegates to the repository. Surfaces typed domain errors unchanged:
 * - OverlapError (dates blocked)
 * - LeadTimeError (heavy transport cutoff)
 *
 * Tests can stub this adapter to avoid touching the DB.
 */
export async function persistPendingBooking(dto: PendingBookingDTO) {
  return createOrReusePendingBooking(dto);
}

export type { PendingBookingDTO };
