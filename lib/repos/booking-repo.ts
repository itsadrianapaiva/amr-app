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
