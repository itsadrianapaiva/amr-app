"use server";

/**
 * Server action: validate booking payload, compute totals, create/reuse a PENDING booking,
 * and create a Stripe Checkout Session for the **deposit** only (deposit-first flow).
 * The deposit Checkout now saves the card for future **off-session** use.
 */

import { getMachineById } from "@/lib/data";
import { parseBookingInput } from "@/lib/booking/parse-input";
import { computeTotals } from "@/lib/pricing";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";
import {
  buildDepositCheckoutSessionParams,
  buildBalanceAuthorizationCheckoutSessionParams, // ⬅️ NEW
} from "@/lib/stripe/checkout";
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

    // 2) Parse + normalize with Lisbon rules (pure helper).
    const minStart = tomorrowStartLisbonUTC();
    const { from, to, days, payload, siteAddrStr } = parseBookingInput(input, {
      minStart,
      minDays: machine.minDays,
    });

    // 2.5) Geofence: only when delivery or pickup is selected.
    const fenceMsg = await checkServiceArea({
      deliverySelected: payload.deliverySelected,
      pickupSelected: payload.pickupSelected,
      siteAddress: siteAddrStr,
    });
    if (fenceMsg) {
      return { ok: false, formError: fenceMsg };
    }

    // 3) Compute totals server-side (authoritative)
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

    // 4) Persist or reuse a PENDING booking (atomic + advisory lock).
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
        taxId: payload.billingTaxId ?? null,
        addressLine1: payload.billingAddressLine1 ?? null,
        postalCode: payload.billingPostalCode ?? null,
        city: payload.billingCity ?? null,
        country: payload.billingCountry ?? null,
      },

      totals: { total: totals.total },
    };

    // This handles: (a) your own abandoned hold → reuse; (b) real conflict → throws OverlapError.
    const booking = await persistPendingBooking(dto);

    // 5) Build **deposit** Checkout (card saved for off-session by builder)
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
      customerEmail: payload.email,
      appUrl,
    });

    const session = await createCheckoutSessionWithGuards(sessionParams, {
      idempotencyKey: `booking-${booking.id}-deposit`,
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
