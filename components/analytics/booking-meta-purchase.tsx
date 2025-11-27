"use client";

import { useEffect, useRef } from "react";
import { metaPurchase } from "@/lib/analytics/metaEvents";

type Props = {
  bookingId: number;
  value: number;
  currency?: string;
  machineId?: number | null;
  machineName?: string | null;
};

/**
 * Client component that fires Meta Purchase event once per booking
 * Uses sessionStorage for hard idempotency to prevent duplicate events on reload
 */
export default function BookingMetaPurchase(props: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;

    const {
      bookingId,
      value,
      currency = "EUR",
      machineId,
      machineName,
    } = props;

    // Guard: ensure value is finite
    if (!Number.isFinite(value)) return;

    // Idempotency via sessionStorage to prevent duplicate events on reload
    const storageKey = `amr_meta_purchase_${bookingId}`;

    try {
      if (typeof sessionStorage !== "undefined") {
        if (sessionStorage.getItem(storageKey)) {
          // Already fired for this booking in this session
          return;
        }
      }
    } catch {
      // sessionStorage may throw in some environments (privacy mode, etc.)
    }

    // Mark as sent
    sentRef.current = true;

    // Fire Meta Purchase event
    metaPurchase({
      bookingId,
      value,
      currency,
      machineId: machineId || bookingId,
      machineName: machineName || `Booking ${bookingId}`,
    });

    // Store flag to prevent duplicates
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(storageKey, "1");
      }
    } catch {
      // Ignore storage errors
    }
  }, [
    props.bookingId,
    props.value,
    props.currency,
    props.machineId,
    props.machineName,
  ]);

  return null;
}
