"use server";

/**
 * Server action: validate booking payload, compute totals (pre-VAT),
 * create/reuse a PENDING booking, and create a Stripe Checkout Session
 * that charges the **full rental upfront**. VAT is computed by Stripe Tax.
 */

import { getMachineById } from "@/lib/data";
import { parseBookingInput } from "@/lib/booking/parse-input";
import {
  computeTotalsFromItems,
  type PricingContextInput,
  type PricingItemInput,
} from "@/lib/pricing";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";
import { buildFullCheckoutSessionParams } from "@/lib/stripe/checkout.full";
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";
import { checkServiceArea } from "@/lib/geo/check-service-area";
import { tomorrowStartLisbonUTC } from "@/lib/dates/lisbon";
import { resolveBaseUrl } from "@/lib/url/base";

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
  equipment?: Array<{ code: string; quantity: number }>;
}) {
  const fp = shortHash(args);
  return `booking-${args.bookingId}-full-v4-${fp}`;
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
    const discountPercentage = Number(payload.discountPercentage ?? 0);

    // Build pricing context for item-aware pricing engine
    const context: PricingContextInput = {
      rentalDays: days,
      deliverySelected: payload.deliverySelected,
      pickupSelected: payload.pickupSelected,
      insuranceSelected: payload.insuranceSelected,
      operatorSelected: Boolean(payload.operatorSelected),
      deliveryCharge: Number(machine.deliveryCharge ?? 0),
      pickupCharge: Number(machine.pickupCharge ?? 0),
      insuranceCharge: INSURANCE_CHARGE,
      operatorCharge: OPERATOR_CHARGE,
      discountPercentage,
    };

    // Build item array: primary machine + equipment addons
    // Hardcoded overrides ensure safety even if Machine has HOUR or PER_UNIT configured
    const items: PricingItemInput[] = [
      {
        quantity: 1,
        chargeModel: "PER_BOOKING", // Slice 4 safety override: force legacy behavior
        timeUnit: "DAY", // Slice 4 safety override: force legacy behavior
        unitPrice: Number(machine.dailyRate),
      },
    ];

    // Add equipment addon items if any selected (Slice 6: equipment with quantity)
    const equipmentAddons = payload.equipmentAddons ?? [];

    // Fetch equipment machines upfront (needed for both pricing and line items)
    let equipmentMachines: Array<{
      code: string;
      name: string;
      dailyRate: any;
      chargeModel: string;
      timeUnit: string;
    }> = [];

    if (equipmentAddons.length > 0) {
      // Fetch equipment addon machines to get pricing info
      const equipmentCodes = equipmentAddons.map((e: any) => e.code);
      const { db } = await import("@/lib/db");
      equipmentMachines = await db.machine.findMany({
        where: {
          code: { in: equipmentCodes },
          itemType: "ADDON",
          addonGroup: "EQUIPMENT",
        },
        select: { code: true, name: true, dailyRate: true, chargeModel: true, timeUnit: true },
      });

      // Build map for quick lookup
      const equipmentMap = new Map(
        equipmentMachines.map((m) => [m.code, m])
      );

      // Validate equipment constraints match Stripe line construction assumptions
      for (const equipMachine of equipmentMachines) {
        if (equipMachine.chargeModel !== "PER_UNIT" || equipMachine.timeUnit !== "DAY") {
          console.error("[checkout] equipment addon has unexpected chargeModel/timeUnit", {
            code: equipMachine.code,
            chargeModel: equipMachine.chargeModel,
            timeUnit: equipMachine.timeUnit,
          });
          return {
            ok: false,
            formError: "Equipment configuration error. Please contact support.",
          };
        }
      }

      // Validate and add equipment items to pricing
      for (const selectedEquip of equipmentAddons) {
        const equipMachine = equipmentMap.get(selectedEquip.code);
        if (!equipMachine) {
          return {
            ok: false,
            formError: `Equipment item ${selectedEquip.code} not found or unavailable.`,
          };
        }

        const qty = Number(selectedEquip.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          return {
            ok: false,
            formError: "Invalid equipment quantity. Please refresh and try again.",
          };
        }

        items.push({
          quantity: qty,
          chargeModel: equipMachine.chargeModel as "PER_BOOKING" | "PER_UNIT",
          timeUnit: equipMachine.timeUnit as "DAY" | "HOUR" | "NONE",
          unitPrice: Number(equipMachine.dailyRate),
        });
      }
    }

    const totals = computeTotalsFromItems(context, items);

    // Calculate original total (before discount) for metadata tracking
    // totals.total is the discounted total; add back the discount to get original
    const originalTotal = totals.total + totals.discount;

    // Debug logging
    if (process.env.LOG_CHECKOUT_DEBUG === "1") {
      console.log("[checkout] totals computed", {
        bookingId: "(pending)",
        machineId: machine.id,
        discountPercentage,
        discountAmount: totals.discount,
        originalTotal,
        finalTotal: totals.total,
        totalCents: Math.round(totals.total * 100),
      });
    }

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

      // Store discount percentage for audit trail
      discountPercentage: Number(payload.discountPercentage ?? 0),

      // Equipment addons with quantities (Slice 6)
      equipmentAddons: equipmentAddons.length > 0 ? equipmentAddons : undefined,
    };

    const booking = await persistPendingBooking(dto);

    // 4.5) Build itemized pre-discount line definitions for Stripe Checkout
    // Compute cents for safety checks
    const totalCents = Math.round(totals.total * 100);
    const originalTotalCents = Math.round(originalTotal * 100);

    type CheckoutLine = {
      key: string;
      name: string;
      unitAmountCents: number;
      quantity: number;
      description?: string;
      kind: "PRIMARY" | "EQUIPMENT" | "SERVICE";
    };

    const preDiscountLines: CheckoutLine[] = [];

    // Float-free Decimal-to-cents conversion (pure string parsing)
    function decimalToCents(value: unknown): number {
      const str = String(value).trim().replace(/,/g, "");
      if (!str || str === "") return 0;

      // Handle negative (defensive; money should be non-negative in this context)
      const isNegative = str.startsWith("-");
      const absolute = isNegative ? str.slice(1) : str;

      // Split on decimal point
      const parts = absolute.split(".");
      if (parts.length > 2) return 0; // Invalid format like "1.2.3"

      // Parse euros (integer part)
      const eurosStr = parts[0] || "0";
      const euros = parseInt(eurosStr, 10);
      if (Number.isNaN(euros)) return 0;

      // Parse cents (fractional part)
      let cents = 0;
      if (parts.length === 2) {
        const centsStr = parts[1];
        if (centsStr.length === 0) {
          cents = 0; // "99." → 9900
        } else if (centsStr.length === 1) {
          // "0.5" → 50 cents
          cents = parseInt(centsStr, 10) * 10;
        } else if (centsStr.length === 2) {
          // "0.29" → 29 cents
          cents = parseInt(centsStr, 10);
        } else {
          // "0.295" → round based on 3rd digit
          const baseCents = parseInt(centsStr.slice(0, 2), 10);
          const thirdDigit = parseInt(centsStr[2], 10);
          cents = baseCents + (thirdDigit >= 5 ? 1 : 0);
        }
        if (Number.isNaN(cents)) return 0;
      }

      const totalCents = euros * 100 + cents;
      return isNegative ? -totalCents : totalCents;
    }

    // Dev-only validation of decimalToCents (float-free conversion)
    if (process.env.LOG_CHECKOUT_DEBUG === "1" || process.env.NODE_ENV !== "production") {
      const testCases = [
        { input: "0.29", expected: 29 },
        { input: "99.50", expected: 9950 },
        { input: "99", expected: 9900 },
        { input: "0.5", expected: 50 },
        { input: "100.00", expected: 10000 },
        { input: "1,234.56", expected: 123456 },
      ];

      for (const { input, expected } of testCases) {
        const result = decimalToCents(input);
        if (result !== expected) {
          console.error(`[decimalToCents] validation failed: ${input} → ${result}, expected ${expected}`);
          throw new Error(`decimalToCents validation failed for "${input}"`);
        }
      }
    }

    // PRIMARY machine line: calculate from machine dailyRate (not from totals.subtotal which includes equipment)
    // totals.subtotal includes ALL items (primary + equipment), so we compute primary separately
    const dailyRateCents = decimalToCents(machine.dailyRate);
    preDiscountLines.push({
      key: "primary",
      name: `${machine.name} rental`,
      unitAmountCents: dailyRateCents,
      quantity: days,
      description: `€${(dailyRateCents / 100).toFixed(2)}/day × ${days} day${days > 1 ? "s" : ""}`,
      kind: "PRIMARY",
    });

    // EQUIPMENT addon lines: compute from items pricing inputs
    // (These were added to items array and priced by computeTotalsFromItems)
    // We need to extract equipment subtotals from the pricing breakdown
    // Since computeTotalsFromItems doesn't break down equipment separately,
    // we'll compute equipment lines from the pricing inputs (items array)
    if (equipmentAddons.length > 0) {
      const equipmentMap = new Map(
        equipmentMachines.map((m) => [m.code, m])
      );

      for (const selectedEquip of equipmentAddons) {
        const equipMachine = equipmentMap.get(selectedEquip.code);
        if (equipMachine) {
          // Use the same pricing logic as items array construction
          const unitPricePerDay = Number(equipMachine.dailyRate);
          const unitPricePerDayCents = Math.round(unitPricePerDay * 100);
          const unitAmountCents = unitPricePerDayCents * days;
          const qty = Number(selectedEquip.quantity);

          preDiscountLines.push({
            key: `equip:${equipMachine.code}`,
            name: equipMachine.name,
            unitAmountCents,
            quantity: qty,
            description: `€${unitPricePerDay.toFixed(2)}/day × ${days} day${days > 1 ? "s" : ""}`,
            kind: "EQUIPMENT",
          });
        }
      }
    }

    // SERVICE addon lines: use values from totals breakdown (authoritative)
    if (totals.delivery > 0) {
      const deliveryChargeCents = Math.round(totals.delivery * 100);
      preDiscountLines.push({
        key: "svc:delivery",
        name: "Delivery",
        unitAmountCents: deliveryChargeCents,
        quantity: 1,
        kind: "SERVICE",
      });
    }

    if (totals.pickup > 0) {
      const pickupChargeCents = Math.round(totals.pickup * 100);
      preDiscountLines.push({
        key: "svc:pickup",
        name: "Pickup",
        unitAmountCents: pickupChargeCents,
        quantity: 1,
        kind: "SERVICE",
      });
    }

    if (totals.insurance > 0) {
      const insuranceChargeCents = Math.round(totals.insurance * 100);
      preDiscountLines.push({
        key: "svc:insurance",
        name: "Insurance",
        unitAmountCents: insuranceChargeCents,
        quantity: 1,
        kind: "SERVICE",
      });
    }

    if (totals.operator > 0) {
      const operatorChargeCents = Math.round(totals.operator * 100);
      preDiscountLines.push({
        key: "svc:operator",
        name: "Driver / Operator",
        unitAmountCents: Math.round(operatorChargeCents / days),
        quantity: days,
        description: `€${(totals.operator / days).toFixed(2)}/day × ${days} day${days > 1 ? "s" : ""}`,
        kind: "SERVICE",
      });
    }

    // Safety check: sum of pre-discount lines must equal originalTotalCents
    const preDiscountSumCents = preDiscountLines.reduce(
      (sum, line) => sum + line.unitAmountCents * line.quantity,
      0
    );

    if (preDiscountSumCents !== originalTotalCents) {
      console.error("[checkout] pre-discount line item mismatch", {
        bookingId: booking.id,
        preDiscountSumCents,
        originalTotalCents,
        diff: preDiscountSumCents - originalTotalCents,
        lines: preDiscountLines,
      });
      return {
        ok: false,
        formError: "Internal pricing error. Please contact support.",
      };
    }

    // Apply discount allocation if needed
    type DiscountedLine = {
      key: string;
      name: string;
      unitAmountCents: number;
      quantity: number;
      description?: string;
    };

    let discountedLines: DiscountedLine[];

    if (discountPercentage <= 0) {
      // No discount: use pre-discount lines as-is
      discountedLines = preDiscountLines.map((line) => ({
        key: line.key,
        name: line.name,
        unitAmountCents: line.unitAmountCents,
        quantity: line.quantity,
        description: line.description,
      }));
    } else {
      // Discount allocation algorithm
      type LineWithRemainder = {
        line: CheckoutLine;
        preLineTotalCents: number;
        discountedFloorCents: number;
        remainderNumerator: number;
      };

      const linesWithRemainder: LineWithRemainder[] = preDiscountLines.map((line) => {
        const preLineTotalCents = line.unitAmountCents * line.quantity;
        const factor = 100 - discountPercentage;
        const discountedFloorCents = Math.floor((preLineTotalCents * factor) / 100);
        const remainderNumerator = (preLineTotalCents * factor) % 100;

        return {
          line,
          preLineTotalCents,
          discountedFloorCents,
          remainderNumerator,
        };
      });

      const sumFloor = linesWithRemainder.reduce(
        (sum, item) => sum + item.discountedFloorCents,
        0
      );

      const remainderToDistribute = totalCents - sumFloor;

      // Safety check
      if (remainderToDistribute < 0 || remainderToDistribute >= linesWithRemainder.length) {
        console.error("[checkout] discount allocation remainder out of bounds", {
          bookingId: booking.id,
          totalCents,
          sumFloor,
          remainderToDistribute,
          numLines: linesWithRemainder.length,
        });
        return {
          ok: false,
          formError: "Internal discount calculation error. Please contact support.",
        };
      }

      // Sort by remainder desc, then key asc for determinism
      const sorted = [...linesWithRemainder].sort((a, b) => {
        if (a.remainderNumerator !== b.remainderNumerator) {
          return b.remainderNumerator - a.remainderNumerator;
        }
        return a.line.key.localeCompare(b.line.key);
      });

      // Distribute +1 cent to top remainderToDistribute lines
      const centsToAdd = new Map<string, number>();
      for (let i = 0; i < remainderToDistribute; i++) {
        centsToAdd.set(sorted[i].line.key, 1);
      }

      // Build final discounted lines
      discountedLines = linesWithRemainder.map((item) => {
        const extraCent = centsToAdd.get(item.line.key) ?? 0;
        const discountedLineTotalCents = item.discountedFloorCents + extraCent;

        // Check divisibility: if quantity > 1 and not evenly divisible, collapse to qty=1
        const qty = item.line.quantity;
        let finalUnitAmountCents: number;
        let finalQuantity: number;
        let finalName = item.line.name;
        let finalDescription = item.line.description;

        if (qty > 1 && discountedLineTotalCents % qty !== 0) {
          // Collapse to quantity=1 and encode original quantity in name
          finalUnitAmountCents = discountedLineTotalCents;
          finalQuantity = 1;
          if (item.line.kind === "EQUIPMENT") {
            finalName = `${item.line.name} (qty ${qty})`;
          } else if (item.line.kind === "PRIMARY" || item.line.kind === "SERVICE") {
            // For services/primary that use days as quantity, encode days in name
            finalName = `${item.line.name} (${qty} day${qty > 1 ? "s" : ""})`;
          }
          // Clear description since qty is now encoded in name
          finalDescription = undefined;
        } else {
          // Evenly divisible or qty=1
          finalUnitAmountCents = Math.floor(discountedLineTotalCents / qty);
          finalQuantity = qty;
        }

        return {
          key: item.line.key,
          name: finalName,
          unitAmountCents: finalUnitAmountCents,
          quantity: finalQuantity,
          description: finalDescription,
        };
      });
    }

    // Final safety check: sum of discounted lines must equal totalCents
    const discountedSumCents = discountedLines.reduce(
      (sum, line) => sum + line.unitAmountCents * line.quantity,
      0
    );

    if (discountedSumCents !== totalCents) {
      console.error("[checkout] discounted line item mismatch", {
        bookingId: booking.id,
        discountedSumCents,
        totalCents,
        diff: discountedSumCents - totalCents,
        lines: discountedLines,
      });
      return {
        ok: false,
        formError: "Internal discount calculation error. Please contact support.",
      };
    }

    // Validate all line items
    for (const line of discountedLines) {
      if (line.unitAmountCents < 0 || !Number.isInteger(line.unitAmountCents)) {
        console.error("[checkout] invalid unitAmountCents", {
          bookingId: booking.id,
          line,
        });
        return {
          ok: false,
          formError: "Internal pricing error. Please contact support.",
        };
      }
      if (line.quantity < 1 || !Number.isInteger(line.quantity)) {
        console.error("[checkout] invalid quantity", {
          bookingId: booking.id,
          line,
        });
        return {
          ok: false,
          formError: "Internal pricing error. Please contact support.",
        };
      }
      // Stripe limit: unit_amount max is 99999999 (in cents, ~€1M)
      if (line.unitAmountCents > 99999999) {
        console.error("[checkout] unit amount exceeds Stripe limit", {
          bookingId: booking.id,
          line,
        });
        return {
          ok: false,
          formError: "Price exceeds payment system limits. Please contact support.",
        };
      }
    }

    // 5) Build FULL Checkout (VAT via Stripe Tax; methods: card + MB WAY + SEPA)
    const appUrl = resolveBaseUrl();
    const sessionParams = buildFullCheckoutSessionParams({
      bookingId: booking.id,
      machine: { id: machine.id, name: machine.name },
      from,
      to,
      days,
      totalEuros: Number(totals.total), // Already discounted
      customerEmail: payload.email,
      appUrl,
      discountPercentage,
      originalTotalEuros: discountPercentage > 0 ? originalTotal : undefined,
      lineItems: discountedLines.map((line) => ({
        name: line.name,
        description: line.description,
        unitAmountCents: line.unitAmountCents,
        quantity: line.quantity,
      })),
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
      equipment: equipmentAddons.length > 0 ? equipmentAddons : undefined,
    });

    // Debug: log full Stripe session params
    if (process.env.LOG_CHECKOUT_DEBUG === "1") {
      console.log("[checkout] stripe session params", {
        bookingId: booking.id,
        mode: sessionParams.mode,
        metadata: sessionParams.metadata,
        line_items: JSON.stringify(sessionParams.line_items, null, 2),
      });
    }

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
      const friendly = e.earliestAllowedDay.toLocaleDateString("auto", {
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
