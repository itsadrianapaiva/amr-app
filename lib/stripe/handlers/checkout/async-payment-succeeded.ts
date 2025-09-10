// Full-upfront pivot:
// - Ignore legacy manual-capture auth sessions.
// - Promote the booking to CONFIRMED on async success (MB WAY / SEPA), attach PI, notify.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractSessionFacts,
  ensurePaymentIntentIdFromSession,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

// glue to issue invoice (decoupled, feature-flagged)
import { maybeIssueInvoice, type BookingFacts } from "@/lib/invoicing/issue-for-booking";

// Use your Prisma singleton
import { db } from "@/lib/db";

/** Public handler used by the registry */
export async function onCheckoutSessionAsyncPaymentSucceeded(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Normalize key facts from the Session (bookingId, flow, PI id if present, total amount).
  const session = event.data.object as Stripe.Checkout.Session;
  const { bookingId, flow, paymentIntentId, amountTotalCents } =
    extractSessionFacts(session);

  // 2) If we cannot tie the session to a booking, log and exit safely.
  if (bookingId == null) {
    log("async_succeeded:no_booking_id", {
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
    });
    return;
  }

  // 3) Legacy safety: we no longer support manual-capture balance authorizations.
  if (flow === "balance_authorize") {
    log("async_succeeded:balance_authorize_ignored", {
      bookingId,
      sessionId: session.id,
      amount_total: amountTotalCents ?? null,
    });
    return;
  }

  // 4) Full payment (covers legacy "deposit" and new "full_upfront"):
  //    Ensure a PI id exists; some async payloads omit it and require expansion.
  const piId =
    paymentIntentId ?? (await ensurePaymentIntentIdFromSession(session, log));

  log("async_succeeded:full_payment_promote", {
    bookingId,
    sessionId: session.id,
    piId: piId ?? null,
    amount_total: amountTotalCents ?? null,
    flow,
  });

  // 5) Idempotent promotion to CONFIRMED + attach PI.
  await promoteBookingToConfirmed({ bookingId, paymentIntentId: piId ?? null }, log);

   // 5.1) Issue legal invoice (feature-flagged, non-fatal on error).
  //      If we couldn't resolve a PI id, we skip issuing (and log) to keep invariants tight.
  try {
    if (piId) {
      const facts = await fetchBookingFacts(bookingId);
      const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);

      const record = await maybeIssueInvoice({
        booking: facts,
        stripePaymentIntentId: piId,
        paidAt,
        notes: undefined,
      });

      if (record) {
        // TODO (next step): persist to Booking or an Invoice table.
        log("invoice:issued", {
          bookingId,
          provider: record.provider,
          providerInvoiceId: record.providerInvoiceId,
          number: record.number,
          atcud: record.atcud ?? null,
          pdfUrl: record.pdfUrl,
        });
      } else {
        log("invoice:skipped_flag", {
          bookingId,
          INVOICING_ENABLED: process.env.INVOICING_ENABLED,
        });
      }
    } else {
      log("invoice:skipped_no_pi", { bookingId, reason: "missing_payment_intent_id" });
    }
  } catch (err) {
    log("invoice:error", {
      bookingId,
      err: err instanceof Error ? err.message : String(err),
    });
    // Do not throw — webhook must return 200 to Stripe.
  }

  // 6) Notify customer (best-effort; non-fatal on error).
  try {
    await notifyBookingConfirmed(bookingId, "customer");
    log("notify:done", { bookingId });
  } catch (err) {
    log("notify:error", {
      bookingId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---- Local helpers (tiny, focused) ----
// NOTE: This duplicates the small helper from the PI path. After both compile, we can
// extract to lib/invoicing/booking-facts.ts to DRY it up (one-file-at-a-time rule today).

async function fetchBookingFacts(bookingId: number): Promise<BookingFacts> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      machine: { select: { name: true, dailyRate: true } },
    },
  });

  if (!booking) throw new Error(`Booking ${bookingId} not found`);
  if (!booking.machine) throw new Error(`Booking ${bookingId} has no machine relation`);

  const unitDailyCents = decimalToCents(booking.machine.dailyRate);

  const nif =
    (booking.billingIsBusiness ? booking.billingTaxId : undefined) ??
    booking.customerNIF ??
    undefined;

  return {
    id: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
    machineName: booking.machine.name,
    unitDailyCents,
    vatPercent: 23, // PT standard

    customerName: booking.customerName,
    customerEmail: booking.customerEmail ?? undefined,
    customerNIF: nif,

    billing: booking.billingIsBusiness
      ? {
          line1: booking.billingAddressLine1 ?? undefined,
          city: booking.billingCity ?? undefined,
          postalCode: booking.billingPostalCode ?? undefined,
          country: (booking.billingCountry as any) ?? "PT",
        }
      : undefined,
  };
}

// Prisma Decimal-safe cents conversion.
function decimalToCents(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : (value as any)?.toNumber
      ? (value as any).toNumber()
      : Number(value);
  return Math.round(n * 100);
}