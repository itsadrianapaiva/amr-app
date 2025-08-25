"use server";

/**
 * Server action: validate booking payload, compute totals, create PENDING booking,
 * and create a Stripe Checkout Session for the **deposit** only.
 */

import {
  startOfDay,
  addDays,
  differenceInCalendarDays,
  formatISO,
} from "date-fns";
import { BookingStatus } from "@prisma/client";

import { getMachineById } from "@/lib/data";
import { db } from "@/lib/db";
import { buildBookingSchema } from "@/lib/validation/booking";
import { computeTotals } from "@/lib/pricing";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";
import { getStripe, toMoney } from "@/lib/stripe";

//  helpers (small & focused) 
function tomorrowStart(): Date {
  return startOfDay(addDays(new Date(), 1));
}
function asDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  return v instanceof Date ? v : new Date(String(v));
}
function rentalDays(from: Date, to: Date) {
  return differenceInCalendarDays(to, from) + 1;
}

/**
 * Input is loosely typed: we rely on Zod to validate/parse.
 * The client should pass all fields from BookingFormValues plus machineId.
 */
export async function createDepositCheckoutAction(
  input: unknown
): Promise<{ url: string }> {
  // 1) Extract machineId early to fetch authoritative machine data.
  const machineId = Number((input as any)?.machineId);
  if (!Number.isFinite(machineId)) {
    throw new Error("Invalid or missing machineId.");
  }

  // 2) Load machine and derive runtime policy inputs.
  const machine = await getMachineById(machineId);
  if (!machine) throw new Error("Machine not found.");

  const minDays = machine.minDays;
  const minStart = tomorrowStart();

  // 3) Validate the payload (dates, contact, add-ons, billing).
  //    Coerce dateRange to Date objects before Zod for safety across environments.
  const schema = buildBookingSchema(minStart, minDays);
  const parsed = schema.parse({
    ...(input as Record<string, unknown>),
    dateRange: {
      from: asDate((input as any)?.dateRange?.from),
      to: asDate((input as any)?.dateRange?.to),
    },
  });

  const from = parsed.dateRange.from!;
  const to = parsed.dateRange.to!;
  const days = rentalDays(from, to);

  // 4) Compute totals *server-side* with authoritative numbers.
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

  // The deposit we charge now is the machine's configured deposit.
  const depositEuros = Number(machine.deposit);

  // 5) Create a PENDING booking row (no payment intent yet — that arrives post-checkout).
  const booking = await db.booking.create({
    data: {
      machineId: machine.id,
      startDate: from,
      endDate: to,

      insuranceSelected: parsed.insuranceSelected,
      deliverySelected: parsed.deliverySelected,
      pickupSelected: parsed.pickupSelected,
      operatorSelected: Boolean(parsed.operatorSelected),

      customerName: parsed.name,
      customerEmail: parsed.email,
      customerPhone: parsed.phone,

      billingIsBusiness: Boolean(parsed.billingIsBusiness),
      billingCompanyName: parsed.billingCompanyName ?? null,
      billingTaxId: parsed.billingTaxId ?? null,
      billingAddressLine1: parsed.billingAddressLine1 ?? null,
      billingPostalCode: parsed.billingPostalCode ?? null,
      billingCity: parsed.billingCity ?? null,
      billingCountry: parsed.billingCountry ?? null,

      totalCost: totals.total, // store the authoritative grand total (euros)
      depositPaid: false,
      // stripePaymentIntentId: set on webhook after checkout completion
      status: BookingStatus.PENDING,
    },
  });

  // 6) Create Stripe Checkout Session for the *deposit only*.
  // IN PRODUCTION set one of the envs explicitly to your actual app URL.
  const stripe = getStripe();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: parsed.email,
    client_reference_id: String(booking.id),
    metadata: {
      bookingId: String(booking.id),
      machineId: String(machine.id),
      startDate: formatISO(from, { representation: "date" }),
      endDate: formatISO(to, { representation: "date" }),
    },
    line_items: [
      {
        price_data: {
          ...toMoney(depositEuros),
          product_data: {
            name: `Booking deposit — ${machine.name}`,
            description: `Dates: ${formatISO(from, {
              representation: "date",
            })} to ${formatISO(to, { representation: "date" })} (${days} day${
              days > 1 ? "s" : ""
            })`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe session did not return a URL.");
  }

  return { url: session.url };
}
