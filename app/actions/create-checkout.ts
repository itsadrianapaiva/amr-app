"use server";

/**
 * Server action: validate booking payload, compute totals (pre-VAT),
 * create/reuse a PENDING booking, and create a Stripe Checkout Session
 * that charges the **full rental upfront**. VAT is computed by Stripe Tax.
 */

import { getMachineById } from "@/lib/data";
import { parseBookingInput } from "@/lib/booking/parse-input";
import { computeTotals } from "@/lib/pricing";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";
import { buildFullCheckoutSessionParams } from "@/lib/stripe/checkout.full";
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";
import { checkServiceArea } from "@/lib/geo/check-service-area";
import { tomorrowStartLisbonUTC } from "@/lib/dates/lisbon";

// Persistence adapter and DTO
import {
  persistPendingBooking,
  type PendingBookingDTO,
} from "@/lib/booking/persist-pending";

// Typed domain errors for UX mapping
import { OverlapError, LeadTimeError } from "@/lib/repos/booking-repo";

// Key changes when any relevant selection changes; identical requests reuse it.
import { createHash } from "node:crypto";

// Return shape supports form-level errors
type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; formError: string };

/** Resolve the canonical base URL for building absolute https redirect URLs. */
function appBaseUrl(): string {
  // Candidate order: explicit overrides first, then Netlify built-ins
  const candidates = [
    process.env.APP_URL?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.URL?.trim(), // Netlify published or branch URL
    process.env.DEPLOY_PRIME_URL?.trim(), // Netlify previews/branch deploys
  ].filter(Boolean) as string[];

  // Ignore accidental literal "$FOO" values (Netlify UI doesn't expand vars)
  const pick = candidates.find((v) => !v.startsWith("$")) ?? "";

  // In production, never fall back to localhost — fail fast and loudly
  if (!pick) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Base URL missing. Provide APP_URL (or rely on Netlify URL/DEPLOY_PRIME_URL)."
      );
    }
    return "http://localhost:3000";
  }

  // Validate and normalize
  let u: URL;
  try {
    u = new URL(pick);
  } catch {
    throw new Error(`APP_URL/URL value is not a valid absolute URL: "${pick}"`);
  }

  // Enforce https scheme in production (Stripe requires absolute https)
  if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
    throw new Error(
      `Base URL must be https in production; got "${u.protocol}".`
    );
  }

  const origin = u.origin;

  if (process.env.LOG_CHECKOUT_DEBUG === "1") {
    // Non-secret breadcrumb to verify which base won
    console.log("[checkout] base_url_resolved", { origin });
  }

  return origin;
}

/** Return YYYY-MM-DD without timezone drift. */
function ymdLisbon(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Small, stable hash so idempotency keys stay short and deterministic. */
function shortHash(input: unknown): string {
  const s = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

/**
 * Build an idempotency key that varies with booking selections.
 * - Same selections → same key (safe re-submit).
 * - Changed add-ons/dates/total → different key (new session allowed).
 */
function makeCheckoutIdempotencyKey(args: {
  bookingId: number;
  startYmd: string;
  endYmd: string;
  total: number;
  delivery: boolean;
  pickup: boolean;
  insurance: boolean;
  operator: boolean;
}) {
  const fp = shortHash(args);
  return `booking-${args.bookingId}-full-v3-${fp}`;
}

export async function createCheckoutAction(
  input: unknown
): Promise<CheckoutResult> {
  try {
    // 1) Fetch machine
    const machineId = Number((input as any)?.machineId);
    if (!Number.isFinite(machineId)) {
      return { ok: false, formError: "Invalid or missing machine selection." };
    }
    const machine = await getMachineById(machineId);
    if (!machine) return { ok: false, formError: "Machine not found." };

    // 2) Parse + normalize with Lisbon rules (inclusive days, cutoff)
    const minStart = tomorrowStartLisbonUTC();
    const { from, to, days, payload, siteAddrStr } = parseBookingInput(input, {
      minStart,
      minDays: machine.minDays,
    });

    // 2.5) Geofence check (only when delivery or pickup is selected)
    const fenceMsg = await checkServiceArea({
      deliverySelected: payload.deliverySelected,
      pickupSelected: payload.pickupSelected,
      siteAddress: siteAddrStr,
    });
    if (fenceMsg) return { ok: false, formError: fenceMsg };

    // 3) Compute totals server-side (authoritative), PRE-VAT
    const totals = computeTotals({
      rentalDays: days,
      dailyRate: Number(machine.dailyRate),
      deliverySelected: payload.deliverySelected,
      pickupSelected: payload.pickupSelected,
      insuranceSelected: payload.insuranceSelected,
      deliveryCharge: Number(machine.deliveryCharge ?? 0),
      pickupCharge: Number(machine.pickupCharge ?? 0),
      insuranceCharge: INSURANCE_CHARGE,
      operatorSelected: Boolean(payload.operatorSelected),
      operatorCharge: OPERATOR_CHARGE,
    });

    // 4) Persist or reuse a PENDING booking (atomic + advisory lock)
    const dto: PendingBookingDTO = {
      machineId: machine.id,
      startDate: from,
      endDate: to,

      insuranceSelected: payload.insuranceSelected,
      deliverySelected: payload.deliverySelected,
      pickupSelected: payload.pickupSelected,
      operatorSelected: Boolean(payload.operatorSelected),

      customer: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        nif: payload.customerNIF ?? null,
      },

      siteAddress: payload.siteAddress,

      billing: {
        isBusiness: Boolean(payload.billingIsBusiness),
        companyName: payload.billingCompanyName ?? null,
        taxId: payload.billingTaxId ?? null, // VAT number captured again in Checkout if needed
        addressLine1: payload.billingAddressLine1 ?? null,
        postalCode: payload.billingPostalCode ?? null,
        city: payload.billingCity ?? null,
        country: payload.billingCountry ?? null,
      },

      // Store **pre-VAT** total; Stripe will compute VAT in Checkout & on receipt.
      totals: { total: totals.total },
    };

    const booking = await persistPendingBooking(dto);

    // 5) Build FULL Checkout (VAT via Stripe Tax; methods: card + MB WAY + SEPA)
    const appUrl = appBaseUrl();
    const sessionParams = buildFullCheckoutSessionParams({
      bookingId: booking.id,
      machine: { id: machine.id, name: machine.name },
      from,
      to,
      days,
      totalEuros: Number(totals.total),
      customerEmail: payload.email,
      appUrl,
    });

    // idempotency key that reflects the current selections.
    const idemKey = makeCheckoutIdempotencyKey({
      bookingId: booking.id,
      startYmd: ymdLisbon(from),
      endYmd: ymdLisbon(to),
      total: Number(totals.total),
      delivery: !!payload.deliverySelected,
      pickup: !!payload.pickupSelected,
      insurance: !!payload.insuranceSelected,
      operator: !!payload.operatorSelected,
    });

    const session = await createCheckoutSessionWithGuards(sessionParams, {
      idempotencyKey: idemKey,
      log: (event, data) => console.debug(`[stripe] ${event}`, data),
    });

    if (!session.url) {
      return {
        ok: false,
        formError: "Stripe did not return a checkout URL. Please try again.",
      };
    }

    return { ok: true, url: session.url };
  } catch (e: any) {
    if (e instanceof LeadTimeError) {
      const friendly = e.earliestAllowedDay.toLocaleDateString("en-GB", {
        timeZone: "Europe/Lisbon",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return {
        ok: false,
        formError:
          `This machine requires scheduling a heavy truck. ` +
          `Earliest start is ${friendly}. Please choose a later date.`,
      };
    }

    if (e instanceof OverlapError) {
      return {
        ok: false,
        formError:
          "Those dates are currently held by another customer. Try a different range or wait a few minutes.",
      };
    }

    // Stripe idempotency-specific UX (e.g., user changed add-ons after opening Checkout)
    if (
      e?.rawType === "idempotency_error" ||
      e?.type === "StripeIdempotencyError"
    ) {
      return {
        ok: false,
        formError:
          "Your selections changed after opening Checkout. Please submit again to create a fresh payment session.",
      };
    }

    console.error("createCheckoutAction failed:", e);
    return {
      ok: false,
      formError: "Unexpected server error. Please try again.",
    };
  }
}
