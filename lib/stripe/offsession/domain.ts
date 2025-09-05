// Domain types + pure helpers for the off-session authorization flow.
// Pure module: no Stripe SDK or DB imports. Keeps the service lean and testable.

/*  Types  */

export type OffSessionAuthSkippedReason =
  | "already_authorized"
  | "no_remaining"
  | "missing_customer_or_pm";

export type OffSessionAuthResult =
  | { kind: "skipped"; reason: OffSessionAuthSkippedReason }
  | { kind: "capturable"; paymentIntentId: string; amountCents: number }
  | { kind: "requires_action"; checkoutUrl: string }
  | { kind: "error"; message: string };

/**
 * Numeric-like input that can come from DB (e.g., Prisma Decimal),
 * plain numbers/strings, or objects that can convert to a number.
 */
export type Decimalish =
  | number
  | string
  | { toNumber(): number } // Prisma.Decimal, decimal.js-light, etc.
  | { valueOf(): number | string }; // last-resort structural fallback

export type MinimalBooking = {
  id: number;
  totalCost: Decimalish;
  customerEmail: string;
  startDate: Date;
  endDate: Date;
  machine: { id: number; name: string; deposit: Decimalish };
  authorizedPaymentIntentId?: string | null;
};

/*  Helpers (pure)  */

/** Coerce numeric-like input to a finite number; returns NaN otherwise. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  if (value && typeof value === "object") {
    const obj = value as any;

    // Prisma.Decimal & friends
    if (typeof obj.toNumber === "function") {
      const n = obj.toNumber();
      return Number.isFinite(n) ? n : NaN;
    }

    // Generic valueOf fallback (may return number|string)
    if (typeof obj.valueOf === "function") {
      const v = obj.valueOf();
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    }
  }

  return NaN;
}

/** Remaining amount in euros (floors at 0). */
export function computeRemainingEuros(
  total: unknown,
  deposit: unknown
): number {
  const t = toNumber(total);
  const d = toNumber(deposit);
  if (!Number.isFinite(t) || !Number.isFinite(d)) return 0;
  return Math.max(0, t - d);
}

/** Compact euros formatting for user-facing messages. */
export function euros2(val: number): string {
  return val.toFixed(2);
}

/** Extract a Stripe-like session.customer id as string (union-safe). */
export function getCustomerIdFromSession(session: any): string | null {
  const c = session?.customer;
  if (!c) return null;
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** Extract a Stripe-like payment_method id from session.payment_intent (union-safe). */
export function getPaymentMethodIdFromSession(session: any): string | null {
  const pi = session?.payment_intent;
  if (!pi || typeof pi === "string") return null;
  const pm = (pi as any).payment_method;
  return pm ? (typeof pm === "string" ? pm : (pm?.id ?? null)) : null;
}

/** Safe debug logger (stringifies to avoid circular structures). */
export function logDebug(event: string, data?: Record<string, unknown>) {
  try {
    console.debug(
      `[auth] ${event}`,
      data ? JSON.parse(JSON.stringify(data)) : undefined
    );
  } catch {
    console.debug(`[auth] ${event}`);
  }
}
