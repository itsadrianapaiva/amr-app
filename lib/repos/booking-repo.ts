// Focused repository adapter for Booking writes.
// Keeps Prisma shape out of actions and normalizes nullable strings.

import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";

/** Normalize empty/whitespace-only strings to null for cleaner DB rows. */
function toNull(s?: string | null): string | null {
  const v = (s ?? "").trim();
  return v.length ? v : null;
}

/**
 * Data needed to create a PENDING booking (MVP scope).
 * - Dates are already normalized to day-start (Lisbon) by the caller.
 * - Totals are computed server-side before calling this function.
 */
export type PendingBookingDTO = {
  machineId: number;
  startDate: Date;
  endDate: Date;

  // Add-ons
  insuranceSelected: boolean;
  deliverySelected: boolean;
  pickupSelected: boolean;
  operatorSelected: boolean;

  // Contact
  customer: {
    name: string;
    email: string;
    phone: string;
    nif?: string | null; // optional personal NIF
  };

  // Operational site address (not invoicing)
  siteAddress?: {
    line1?: string | null;
    postalCode?: string | null;
    city?: string | null;
    notes?: string | null;
  };

  // Invoicing (business)
  billing: {
    isBusiness: boolean;
    companyName?: string | null;
    taxId?: string | null;
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  };

  // Money
  totals: {
    total: number; // euros
  };
};

/** A typed error we can catch in actions to show a friendly overlap message. */
export class OverlapError extends Error {
  constructor(message = "Selected dates are no longer available.") {
    super(message);
    this.name = "OverlapError";
  }
}

/**
 * Create a PENDING booking row.
 * Single responsibility: map a DTO to the Prisma shape and write it.
 * Returns the created booking row.
 */
export async function createPendingBooking(dto: PendingBookingDTO) {
  const {
    machineId,
    startDate,
    endDate,
    insuranceSelected,
    deliverySelected,
    pickupSelected,
    operatorSelected,
    customer,
    billing,
    siteAddress,
    totals,
  } = dto;

  return db.booking.create({
    data: {
      machineId,
      startDate,
      endDate,

      insuranceSelected,
      deliverySelected,
      pickupSelected,
      operatorSelected,

      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerNIF: toNull(customer.nif ?? null),

      siteAddressLine1: toNull(siteAddress?.line1 ?? null),
      siteAddressPostalCode: toNull(siteAddress?.postalCode ?? null),
      siteAddressCity: toNull(siteAddress?.city ?? null),
      siteAddressNotes: toNull(siteAddress?.notes ?? null),

      billingIsBusiness: billing.isBusiness,
      billingCompanyName: toNull(billing.companyName ?? null),
      billingTaxId: toNull(billing.taxId ?? null),
      billingAddressLine1: toNull(billing.addressLine1 ?? null),
      billingPostalCode: toNull(billing.postalCode ?? null),
      billingCity: toNull(billing.city ?? null),
      billingCountry: toNull(billing.country ?? null),

      totalCost: totals.total, // authoritative grand total in euros
      depositPaid: false,
      status: BookingStatus.PENDING,
    },
  });
}

/**
 * createOrReusePendingBooking
 * Atomically:
 * 1) Takes a per-machine advisory transaction lock.
 * 2) Reuses an existing PENDING hold when it is the *same customer email* and *exact same dates*.
 * 3) Otherwise attempts to create a new PENDING row.
 * 4) If the DB exclusion constraint blocks us (someone else holds it), throw OverlapError.
 */
export async function createOrReusePendingBooking(dto: PendingBookingDTO) {
  const {
    machineId,
    startDate,
    endDate,
    insuranceSelected,
    deliverySelected,
    pickupSelected,
    operatorSelected,
    customer,
    billing,
    siteAddress,
    totals,
  } = dto;

  // 30-minute rolling hold window
  const newExpiry = new Date(Date.now() + 30 * 60 * 1000);

  return db.$transaction(async (tx) => {
    // 1) Serialize concurrent attempts for the same machine.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1}::int4, ${machineId}::int4)`;

    // 2) Reuse: same machine + same exact dates + same email + still PENDING.
    //    If found, extend the expiry to keep the checkout window alive.
    const existing = await tx.booking.findFirst({
      where: {
        machineId,
        status: BookingStatus.PENDING,
        startDate,
        endDate,
        customerEmail: customer.email,
      },
      select: { id: true, holdExpiresAt: true },
    });

    if (existing) {
      // Only extend forward (never shorten)
      if (!existing.holdExpiresAt || existing.holdExpiresAt < newExpiry) {
        await tx.booking.update({
          where: { id: existing.id },
          data: { holdExpiresAt: newExpiry },
          select: { id: true },
        });
      }
      return { id: existing.id };
    }

    // 3) Try to create a fresh PENDING row with a new expiry.
    try {
      return await tx.booking.create({
        data: {
          machineId,
          startDate,
          endDate,

          insuranceSelected,
          deliverySelected,
          pickupSelected,
          operatorSelected,

          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerNIF: toNull(customer.nif ?? null),

          siteAddressLine1: toNull(siteAddress?.line1 ?? null),
          siteAddressPostalCode: toNull(siteAddress?.postalCode ?? null),
          siteAddressCity: toNull(siteAddress?.city ?? null),
          siteAddressNotes: toNull(siteAddress?.notes ?? null),

          billingIsBusiness: billing.isBusiness,
          billingCompanyName: toNull(billing.companyName ?? null),
          billingTaxId: toNull(billing.taxId ?? null),
          billingAddressLine1: toNull(billing.addressLine1 ?? null),
          billingPostalCode: toNull(billing.postalCode ?? null),
          billingCity: toNull(billing.city ?? null),
          billingCountry: toNull(billing.country ?? null),

          totalCost: totals.total,
          depositPaid: false,
          status: BookingStatus.PENDING,

          // hold expiry for customer checkout window
          holdExpiresAt: newExpiry,
        },
        select: { id: true },
      });
    } catch (e) {
      // 4) Map DB exclusion constraint to a typed error for nicer UX.
      const msg = e instanceof Error ? e.message : String(e);
      const looksLikeOverlap =
        msg.includes("booking_no_overlap_for_active") ||
        msg.toLowerCase().includes("exclusion") ||
        msg.toLowerCase().includes("overlap");

      if (looksLikeOverlap) {
        throw new OverlapError();
      }
      throw e;
    }
  });
}
