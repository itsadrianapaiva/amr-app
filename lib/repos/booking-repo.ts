// Focused repository adapter for Booking writes.
// Keeps Prisma shape out of actions and normalizes nullable strings.

import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { validateLeadTimeLisbon } from "@/lib/logistics/lead-time";

//  small repo-level types/errors
/** Optional behavior toggles for repo guards. */
export type BookingRepoOptions = {
  /** Allow managers to bypass lead-time (used in /ops). Defaults to false. */
  bypassLeadTime?: boolean;
  /** Per-business rule knobs with safe defaults. */
  leadDays?: number; // default 2 for heavy machines
  cutoffHour?: number; // default 15 (3pm Lisbon)
};

/** Typed error for "too soon" starts on heavy-transport machines. */
export class LeadTimeError extends Error {
  public readonly earliestAllowedDay: Date;
  public readonly minDays: number;
  constructor(message: string, earliestAllowedDay: Date, minDays: number) {
    super(message);
    this.name = "LeadTimeError";
    this.earliestAllowedDay = earliestAllowedDay;
    this.minDays = minDays;
  }
}

/** Normalize empty/whitespace-only strings to null for cleaner DB rows. */
function toNull(s?: string | null): string | null {
  const v = (s ?? "").trim();
  return v.length ? v : null;
}

/**
 * Compute stored quantity for BookingItem based on charge model, time unit, and rental duration.
 * For DAY-based items, quantity includes rentalDays multiplication to match Stripe metadata.
 *
 * @param baseQuantity - Units for PER_UNIT items (e.g., 2 hammers), 1 for PER_BOOKING items
 * @param timeUnit - DAY (multiply by rentalDays), NONE/HOUR (no multiplication)
 * @param rentalDays - Inclusive rental days
 * @returns Stored quantity for BookingItem
 */
function computeStoredQuantity(
  baseQuantity: number,
  timeUnit: string,
  rentalDays: number
): number {
  if (timeUnit === "DAY") {
    const storedQty = baseQuantity * rentalDays;
    // Defensive check: stored quantity must be at least rentalDays for DAY items
    if (storedQty < rentalDays) {
      throw new Error(
        `Invalid stored quantity: baseQuantity=${baseQuantity}, rentalDays=${rentalDays}, storedQty=${storedQty}`
      );
    }
    return storedQty;
  }
  // NONE or HOUR: no duration multiplication
  return baseQuantity;
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

  // Add-ons (services)
  insuranceSelected: boolean;
  deliverySelected: boolean;
  pickupSelected: boolean;
  operatorSelected: boolean;

  // Add-ons (equipment with quantity)
  equipmentAddons?: Array<{ code: string; quantity: number }>;

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

  // Discount
  discountPercentage: number; // 0-100
};

/** A typed error we can catch in actions to show a friendly overlap message. */
export class OverlapError extends Error {
  constructor(message = "Selected dates are no longer available.") {
    super(message);
    this.name = "OverlapError";
  }
}

//  heavy machine config (MVP: hard-coded IDs 5,6,7)
// later we can migrate this to DB flags.
const HEAVY_MACHINE_IDS = new Set<number>([5, 6, 7]); // medium excavator, large excavator, telehandler

/** Map DTO fields into a Booking update payload (keeps create/update in sync). */
function mapDtoToBookingUpdate(dto: PendingBookingDTO) {
  const {
    insuranceSelected,
    deliverySelected,
    pickupSelected,
    operatorSelected,
    customer,
    billing,
    siteAddress,
    totals,
    discountPercentage,
  } = dto;

  return {
    // Add-ons
    insuranceSelected,
    deliverySelected,
    pickupSelected,
    operatorSelected,

    // Contact
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerNIF: toNull(customer.nif ?? null),

    // Site address (ops)
    siteAddressLine1: toNull(siteAddress?.line1 ?? null),
    siteAddressPostalCode: toNull(siteAddress?.postalCode ?? null),
    siteAddressCity: toNull(siteAddress?.city ?? null),
    siteAddressNotes: toNull(siteAddress?.notes ?? null),

    // Billing (invoicing)
    billingIsBusiness: billing.isBusiness,
    billingCompanyName: toNull(billing.companyName ?? null),
    billingTaxId: toNull(billing.taxId ?? null),
    billingAddressLine1: toNull(billing.addressLine1 ?? null),
    billingPostalCode: toNull(billing.postalCode ?? null),
    billingCity: toNull(billing.city ?? null),
    billingCountry: toNull(billing.country ?? null),

    // Money (authoritative pre-VAT total)
    totalCost: totals.total,
    discountPercentage: discountPercentage,
  };
}

/**
 * Create a PENDING booking row.
 * Single responsibility: map a DTO to the Prisma shape and write it.
 * Returns the created booking row.
 */
export async function createPendingBooking(dto: PendingBookingDTO) {
  // Reuse the same field mapping as updates, plus the create-only fields
  const mapped = mapDtoToBookingUpdate(dto);

  return db.booking.create({
    data: {
      machineId: dto.machineId,
      startDate: dto.startDate,
      endDate: dto.endDate,

      ...mapped, // add-ons, contact, site/billing, totalCost

      depositPaid: false, // still our “paid” flag in the pivoted model
      status: BookingStatus.PENDING,
      // holdExpiresAt is set by the caller where needed (e.g., reuse/create flow)
    },
    select: { id: true },
  });
}

/**
 * createOrReusePendingBooking
 * Atomically:
 * 1) (Pre-check) Enforce lead-time for heavy machines unless bypassed (Lisbon cutoff-aware).
 * 2) Takes a per-machine advisory transaction lock.
 * 3) Reuses an existing PENDING hold when it is the *same customer email* and *exact same dates*.
 * 4) Otherwise attempts to create a new PENDING row.
 * 5) Writes BookingItem rows for the booking (single-item for now).
 * 6) If the DB exclusion constraint blocks us (someone else holds it), throw OverlapError.
 */
export async function createOrReusePendingBooking(
  dto: PendingBookingDTO,
  options: BookingRepoOptions = {}
) {
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

  //  (1) Lead-time guard for heavy machines
  const isHeavy = HEAVY_MACHINE_IDS.has(machineId);
  const bypass = options.bypassLeadTime === true;
  const leadDays = options.leadDays ?? 2; // business rule: 2-day lead time
  const cutoffHour = options.cutoffHour ?? 15; // business rule: 15:00 Lisbon cutoff

  if (isHeavy && !bypass) {
    const { ok, earliestAllowedDay, minDays } = validateLeadTimeLisbon({
      startDate,
      leadDays,
      cutoffHour,
    });
    if (!ok) {
      // Simple Lisbon-friendly date for UX; actions can tailor the copy.
      const friendly = earliestAllowedDay.toLocaleDateString("en-GB", {
        timeZone: "Europe/Lisbon",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      throw new LeadTimeError(
        `This machine requires scheduling a heavy truck. Earliest start is ${friendly}.`,
        earliestAllowedDay,
        minDays
      );
    }
  }

  // 30-minute rolling hold window
  const newExpiry = new Date(Date.now() + 30 * 60 * 1000);

  // Add explicit timeout/maxWait to avoid "Transaction already closed" in dev/HMR
  return db.$transaction(
    async (tx) => {
      // 2) Serialize concurrent attempts for the same machine.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1}::int4, ${machineId}::int4)`;

      // Fetch machine snapshot for BookingItem creation
      const machine = await tx.machine.findUnique({
        where: { id: machineId },
        select: {
          dailyRate: true,
          itemType: true,
          chargeModel: true,
          timeUnit: true,
          deliveryCharge: true,
          pickupCharge: true,
        },
      });

      if (!machine) {
        throw new Error(
          `Machine with id ${machineId} not found. This should not happen.`
        );
      }

      // Fetch service addon machines by code for creating addon BookingItems
      const serviceAddonCodes: string[] = [];
      if (deliverySelected) serviceAddonCodes.push("addon-delivery");
      if (pickupSelected) serviceAddonCodes.push("addon-pickup");
      if (insuranceSelected) serviceAddonCodes.push("addon-insurance");
      if (operatorSelected) serviceAddonCodes.push("addon-operator");

      const serviceAddonMachines = serviceAddonCodes.length > 0
        ? await tx.machine.findMany({
            where: { code: { in: serviceAddonCodes } },
            select: {
              id: true,
              code: true,
              dailyRate: true,
              itemType: true,
              chargeModel: true,
              timeUnit: true,
            },
          })
        : [];

      // Fetch equipment addon machines (Slice 6)
      const equipmentAddons = dto.equipmentAddons ?? [];
      const equipmentCodes = equipmentAddons.map((e) => e.code);
      const equipmentMachines = equipmentCodes.length > 0
        ? await tx.machine.findMany({
            where: {
              code: { in: equipmentCodes },
              itemType: "ADDON",
              addonGroup: "EQUIPMENT",
            },
            select: {
              id: true,
              code: true,
              dailyRate: true,
              itemType: true,
              chargeModel: true,
              timeUnit: true,
            },
          })
        : [];

      // Build equipment map for quantity lookup
      const equipmentMap = new Map(
        equipmentAddons.map((e) => [e.code, e.quantity])
      );

      // Map addon code → unitPrice from charges
      const addonPriceMap: Record<string, number> = {
        "addon-delivery": Number(machine.deliveryCharge ?? 0),
        "addon-pickup": Number(machine.pickupCharge ?? 0),
        "addon-insurance": 50, // INSURANCE_CHARGE from config
        "addon-operator": 350, // OPERATOR_CHARGE from config
      };

      // Compute rentalDays (inclusive days) for quantity calculation
      const rentalDays = Math.max(
        1,
        Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
      );

      // 3) Reuse: same machine + same exact dates + same email + still PENDING.
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
        // Update add-ons, contact, site/billing, totals AND extend hold
        const updateData = {
          ...mapDtoToBookingUpdate(dto),
          holdExpiresAt:
            existing.holdExpiresAt && existing.holdExpiresAt > newExpiry
              ? existing.holdExpiresAt
              : newExpiry,
        };

        await tx.booking.update({
          where: { id: existing.id },
          data: updateData,
          select: { id: true },
        });

        // Write BookingItem rows (idempotent: delete + create)
        await tx.bookingItem.deleteMany({
          where: { bookingId: existing.id },
        });

        // Create primary machine item
        const primaryQuantity = computeStoredQuantity(1, machine.timeUnit, rentalDays);
        await tx.bookingItem.create({
          data: {
            bookingId: existing.id,
            machineId,
            quantity: primaryQuantity,
            isPrimary: true,
            unitPrice: machine.dailyRate,
            itemType: machine.itemType,
            chargeModel: machine.chargeModel,
            timeUnit: machine.timeUnit,
          },
        });

        // Create service addon items (if selected)
        for (const addon of serviceAddonMachines) {
          const addonQuantity = computeStoredQuantity(1, addon.timeUnit, rentalDays);
          await tx.bookingItem.create({
            data: {
              bookingId: existing.id,
              machineId: addon.id,
              quantity: addonQuantity,
              isPrimary: false,
              unitPrice: addonPriceMap[addon.code] ?? 0,
              itemType: addon.itemType,
              chargeModel: addon.chargeModel,
              timeUnit: addon.timeUnit,
            },
          });
        }

        // Create equipment addon items (Slice 6)
        for (const equipMachine of equipmentMachines) {
          const baseQuantity = equipmentMap.get(equipMachine.code) ?? 1;
          const equipQuantity = computeStoredQuantity(baseQuantity, equipMachine.timeUnit, rentalDays);
          await tx.bookingItem.create({
            data: {
              bookingId: existing.id,
              machineId: equipMachine.id,
              quantity: equipQuantity,
              isPrimary: false,
              unitPrice: equipMachine.dailyRate,
              itemType: equipMachine.itemType,
              chargeModel: equipMachine.chargeModel,
              timeUnit: equipMachine.timeUnit,
            },
          });
        }

        return { id: existing.id };
      }

      // (4) Create fresh PENDING; keep overlap guard
      try {
        const created = await tx.booking.create({
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

            holdExpiresAt: newExpiry,
          },
          select: { id: true },
        });

        // Write BookingItem rows for new booking
        // Primary machine item
        const primaryQuantity = computeStoredQuantity(1, machine.timeUnit, rentalDays);
        await tx.bookingItem.create({
          data: {
            bookingId: created.id,
            machineId,
            quantity: primaryQuantity,
            isPrimary: true,
            unitPrice: machine.dailyRate,
            itemType: machine.itemType,
            chargeModel: machine.chargeModel,
            timeUnit: machine.timeUnit,
          },
        });

        // Create service addon items (if selected)
        for (const addon of serviceAddonMachines) {
          const addonQuantity = computeStoredQuantity(1, addon.timeUnit, rentalDays);
          await tx.bookingItem.create({
            data: {
              bookingId: created.id,
              machineId: addon.id,
              quantity: addonQuantity,
              isPrimary: false,
              unitPrice: addonPriceMap[addon.code] ?? 0,
              itemType: addon.itemType,
              chargeModel: addon.chargeModel,
              timeUnit: addon.timeUnit,
            },
          });
        }

        // Create equipment addon items (Slice 6)
        for (const equipMachine of equipmentMachines) {
          const baseQuantity = equipmentMap.get(equipMachine.code) ?? 1;
          const equipQuantity = computeStoredQuantity(baseQuantity, equipMachine.timeUnit, rentalDays);
          await tx.bookingItem.create({
            data: {
              bookingId: created.id,
              machineId: equipMachine.id,
              quantity: equipQuantity,
              isPrimary: false,
              unitPrice: equipMachine.dailyRate,
              itemType: equipMachine.itemType,
              chargeModel: equipMachine.chargeModel,
              timeUnit: equipMachine.timeUnit,
            },
          });
        }

        return created;
      } catch (e) {
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
    },
    {
      // Give dev server/HMR and first-hit compile some headroom
      timeout: 12000, // ms a transaction is allowed to run
      maxWait: 5000, // ms to wait to acquire a transactional slot
      // isolationLevel: "Serializable", // (leave default; not needed here)
    }
  );
}
