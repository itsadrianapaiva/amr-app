"use server";

/**
 * Server action: validate booking payload, compute totals, create/reuse a PENDING booking,
 * and create a Stripe Checkout Session for the **deposit** only.
 */
import { getMachineById } from "@/lib/data";
import { buildBookingSchema } from "@/lib/validation/booking";
import { computeTotals } from "@/lib/pricing";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";
import { getStripe } from "@/lib/stripe";
import { buildDepositCheckoutSessionParams } from "@/lib/stripe/checkout";

import {
  tomorrowStartLisbonUTC,
  asLisbonDateOnly,
  rentalDaysInclusive,
} from "@/lib/dates/lisbon";

import {
  createOrReusePendingBooking,
  OverlapError,
  type PendingBookingDTO,
} from "@/lib/repos/booking-repo";

// Return shape now supports ErrorSummary-friendly failures.
type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; formError: string };

export async function createDepositCheckoutAction(
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

    // 2) Build schema with runtime rules and parse input (dates normalized to Lisbon day)
    const minStart = tomorrowStartLisbonUTC();
    const schema = buildBookingSchema(minStart, machine.minDays);
    const parsed = schema.parse({
      ...(input as Record<string, unknown>),
      dateRange: {
        from: asLisbonDateOnly((input as any)?.dateRange?.from),
        to: asLisbonDateOnly((input as any)?.dateRange?.to),
      },
    });

    const from = parsed.dateRange.from!;
    const to = parsed.dateRange.to!;
    const days = rentalDaysInclusive(from, to);

    // 3) Compute totals server-side (authoritative)
    const totals = computeTotals({
      rentalDays: days,
      dailyRate: Number(machine.dailyRate),
      deliverySelected: parsed.deliverySelected,
      pickupSelected: parsed.pickupSelected,
      insuranceSelected: parsed.insuranceSelected,
      deliveryCharge: Number(machine.deliveryCharge ?? 0),
      pickupCharge: Number(machine.pickupCharge ?? 0),
      insuranceCharge: INSURANCE_CHARGE,
      operatorSelected: Boolean(parsed.operatorSelected),
      operatorCharge: OPERATOR_CHARGE,
    });

    // 4) Persist or reuse a PENDING booking (atomic + advisory lock).
    const dto: PendingBookingDTO = {
      machineId: machine.id,
      startDate: from,
      endDate: to,

      insuranceSelected: parsed.insuranceSelected,
      deliverySelected: parsed.deliverySelected,
      pickupSelected: parsed.pickupSelected,
      operatorSelected: Boolean(parsed.operatorSelected),

      customer: {
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        nif: parsed.customerNIF ?? null,
      },

      siteAddress: parsed.siteAddress,

      billing: {
        isBusiness: Boolean(parsed.billingIsBusiness),
        companyName: parsed.billingCompanyName ?? null,
        taxId: parsed.billingTaxId ?? null,
        addressLine1: parsed.billingAddressLine1 ?? null,
        postalCode: parsed.billingPostalCode ?? null,
        city: parsed.billingCity ?? null,
        country: parsed.billingCountry ?? null,
      },

      totals: { total: totals.total },
    };

    // This handles: (a) your own abandoned hold → reuse; (b) real conflict → throws OverlapError.
    const booking = await createOrReusePendingBooking(dto);

    // 5) Create Stripe Checkout Session for the *deposit only*.
    const stripe = getStripe();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    const sessionParams = buildDepositCheckoutSessionParams({
      bookingId: booking.id,
      machine: { id: machine.id, name: machine.name },
      from,
      to,
      days,
      depositEuros: Number(machine.deposit),
      customerEmail: parsed.email,
      appUrl,
    });

    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) {
      return {
        ok: false,
        formError: "Stripe did not return a checkout URL. Please try again.",
      };
    }

    return { ok: true, url: session.url };
  } catch (e: any) {
    // Friendly mapping for “dates taken” (DB exclusion constraint under the hood)
    if (e instanceof OverlapError) {
      return {
        ok: false,
        formError:
          "Those dates are currently held by another customer. Try a different range or wait a few minutes.",
      };
    }

    // Zod will throw on parse errors above—surface a concise message if present
    if (e?.name === "ZodError" && e?.issues?.length) {
      return { ok: false, formError: e.issues[0]?.message ?? "Invalid input." };
    }

    console.error("createDepositCheckoutAction failed:", e);
    return {
      ok: false,
      formError: "Unexpected server error. Please try again.",
    };
  }
}
