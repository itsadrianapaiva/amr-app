// - Promote the booking (idempotent), attach PI, notify.
// - Ignore legacy manual-capture auth flow safely.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractPIFacts,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

// glue to issue invoice
import {
  maybeIssueInvoice,
  type BookingFacts,
} from "@/lib/invoicing/issue-for-booking";

import { db } from "@/lib/db";

import { notifyInvoiceReady } from "@/lib/notifications/notify-invoice-ready";

/**
 * onPaymentIntentSucceeded
 * Primary path for card (immediate) success.
 * Async methods (MB WAY / SEPA) are primarily handled by
 * `checkout.session.async_payment_succeeded`, but this remains
 * as a robust backstop (idempotent).
 */
export async function onPaymentIntentSucceeded(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Normalize facts from the PI (bookingId + flow)
  const pi = event.data.object as Stripe.PaymentIntent;
  const { bookingId, flow } = extractPIFacts(pi);

  // 2) Legacy safety: ignore manual-capture auth flow
  if (flow === "balance_authorize") {
    log("pi.succeeded:balance_authorize_ignored", { piId: pi.id });
    return;
  }

  // 3) If we can’t tie to a booking, log and exit safely
  if (!bookingId) {
    log("pi.succeeded:no_booking_id", { metadata: pi.metadata });
    return;
  }

  // 4) Promote booking to CONFIRMED and attach the PI id (idempotent)
  log("pi.succeeded:full_payment_promote", { bookingId, piId: pi.id });
  await promoteBookingToConfirmed({ bookingId, paymentIntentId: pi.id }, log);

  // 4.1) Issue legal invoice (feature-flagged, non-fatal on error)
  //      Kept synchronous for correctness; small external call. If needed,
  //      we can queue this later.
  try {
    const facts = await fetchBookingFacts(bookingId);
    const paidAt = new Date(
      (pi.created ?? Math.floor(Date.now() / 1000)) * 1000
    );

    const record = await maybeIssueInvoice({
      booking: facts,
      stripePaymentIntentId: pi.id,
      paidAt,
      notes: undefined, // optional footer text
    });

    if (record) {
      // persist invoice to Booking for Ops & customer access
      await db.booking.update({
        where: { id: bookingId },
        data: {
          invoiceProvider: record.provider,
          invoiceProviderId: record.providerInvoiceId,
          invoiceNumber: record.number,
          invoicePdfUrl: record.pdfUrl,
          invoiceAtcud: record.atcud ?? null,
          updatedAt: new Date(),
        },
      });

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
  } catch (err) {
    log("invoice:error", {
      bookingId,
      err: err instanceof Error ? err.message : String(err),
    });
    // Do not throw — Stripe webhook must continue to 200.
  }

  // 5) Notify customer (best-effort; non-fatal on error)
  log("notify:start", { bookingId, SEND_EMAILS: process.env.SEND_EMAILS });
  try {
    await notifyBookingConfirmed(bookingId, "customer");
    log("notify:done", { bookingId });
  } catch (err) {
    log("notify:error", {
      bookingId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 6) Then notify “invoice ready” (idempotent; runs only once when invoice exists)
  log("invoice_ready:start", { bookingId });
  try {
    const sent = await notifyInvoiceReady(bookingId);
    if (sent) {
      log("invoice_ready:done", { bookingId });
    }
  } catch (err) {
    log("invoice_ready:error", {
      bookingId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---- Local helpers (tiny, focused) ----

async function fetchBookingFacts(bookingId: number): Promise<BookingFacts> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      machine: { select: { name: true, dailyRate: true } },
    },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }
  if (!booking.machine) {
    throw new Error(`Booking ${bookingId} has no machine relation`);
  }

  const unitDailyCents = decimalToCents(booking.machine.dailyRate);

  // Prefer business billing NIF if business toggle was used, otherwise fall back.
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
    vatPercent: 23, // PT standard; adjust per-machine if needed later

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

// db Decimal-safe cents conversion.
function decimalToCents(value: unknown): number {
  // db.Decimal has toNumber(); keep it duck-typed.
  const n =
    typeof value === "number"
      ? value
      : (value as any)?.toNumber
        ? (value as any).toNumber()
        : Number(value);
  return Math.round(n * 100);
}
