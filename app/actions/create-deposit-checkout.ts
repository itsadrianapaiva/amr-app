"use server";

/**
 * Server action: validate booking payload, compute totals, create PENDING booking,
 * and create a Stripe Checkout Session for the **deposit** only.
 */
import { getMachineById } from "@/lib/data";
import { db } from "@/lib/db";
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
  createPendingBooking,
  type PendingBookingDTO,
} from "@/lib/repos/booking-repo";

/**
 * Input is loosely typed: we rely on Zod to validate/parse.
 * The client should pass all fields from BookingFormValues plus machineId.
 */
export async function createDepositCheckoutAction(
  input: unknown
): Promise<{ url: string }> {
  // 1) Fetch machine
  const machineId = Number((input as any)?.machineId);
  if (!Number.isFinite(machineId))
    throw new Error("Invalid or missing machineId.");
  const machine = await getMachineById(machineId);
  if (!machine) throw new Error("Machine not found.");

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

  // 3) Compute totals *server-side* with authoritative numbers.
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

  // 4) Persist a PENDING booking via the repo (no Prisma here)
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

  const booking = await createPendingBooking(dto);

  // 5) Create Stripe Checkout Session for the *deposit only*.
  // IN PRODUCTION set one of the envs explicitly to your actual app URL.
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
    throw new Error("Stripe session did not return a URL.");
  }

  return { url: session.url };
}
