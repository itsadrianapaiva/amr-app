// Small, framework-free helpers to read common fields from a Stripe Checkout Session.
// Keep types minimal to avoid pulling Stripe types into RSC code.

export type MinimalCheckoutSession = {
  client_reference_id?: string | null;
  metadata?: Record<string, unknown> | null;
  payment_intent?:
    | string
    | { id?: string | null; status?: string | null }
    | null;
  payment_status?: string | null;
  status?: string | null;
};

/** Read key metadata set during Checkout creation (bookingId, machineId, dates). */
export function getMetaFromCheckoutSession(session: MinimalCheckoutSession) {
  const meta = (session?.metadata ?? {}) as Record<string, unknown>;
  const bookingIdRaw = session?.client_reference_id ?? null;

  return {
    bookingId: toNumberOrNaN(bookingIdRaw),
    machineId: toNumberOrUndefined(meta["machineId"]),
    startDate: (meta["startDate"] as string | undefined) ?? undefined,
    endDate: (meta["endDate"] as string | undefined) ?? undefined,
  };
}

/** Normalize PaymentIntent id regardless of whether Stripe expanded it. */
export function getPaymentIntentId(
  session: MinimalCheckoutSession
): string | null {
  const pi = session?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : (pi.id ?? null);
}

/** Check if payment has definitively succeeded (covers expanded PI status). */
export function isPaymentComplete(session: MinimalCheckoutSession): boolean {
  const paidFlag =
    session?.payment_status === "paid" || session?.status === "complete";

  const pi = session?.payment_intent;
  const piSucceeded = typeof pi === "object" && pi?.status === "succeeded";

  return Boolean(paidFlag || piSucceeded);
}

/* ───────────── internal tiny helpers ───────────── */

function toNumberOrNaN(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
