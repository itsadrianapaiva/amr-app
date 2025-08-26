"use client";

import { useEffect } from "react";
import { clearDraft } from "@/lib/client/draft";

/**
 * Clears the per-machine session draft on mount.
 * Use on the booking success page after promotion to CONFIRMED.
 */
export default function ClearBookingDraft(props: {
  machineId: number | string;
}) {
  const { machineId } = props;

  // On mount, remove the draft key like `amr:draft:12`
  useEffect(() => {
    clearDraft(`amr:draft:${machineId}`);
  }, [machineId]);

  // No UI; this is a behavior-only component
  return null;
}
