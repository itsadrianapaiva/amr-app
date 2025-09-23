// lib/invoicing/vendors/vendus/payload.ts
import "server-only";
import type { DocType } from "./core";
import { MODE, lisbonYmd, mapVatToTaxId } from "./core";
import type { InvoiceCreateInput } from "../../provider";

/**
 * Vendus v1.1 "items" line (subset).
 * v1.1 rejects `name` and `price`; expects `title` and `gross_price`.
 */
export type VendusItem = {
  title: string; // description
  qty: number; // quantity
  gross_price: number; // unit price including VAT (2 decimals)
  tax_id: "NOR" | "INT" | "RED" | "ISE";
  reference?: string; // our internal reference
  tax_exemption_law?: string; // legal code when tax_id === "ISE"
};

/** Transform provider-agnostic lines into Vendus v1.1 items. */
export function toVendusItems(
  lines: InvoiceCreateInput["lines"] | undefined
): VendusItem[] {
  // Defensive: tolerate undefined and empty arrays
  const src = Array.isArray(lines) ? lines : [];
  return src.map((l) => {
    const tax_id = mapVatToTaxId(l.vatPercent);
    const net = Number((l.unitPriceCents / 100).toFixed(2));
    // v1.1 expects gross_price. For ISE, gross == net.
    const gross =
      tax_id === "ISE"
        ? net
        : Number((net * (1 + l.vatPercent / 100)).toFixed(2));

    if (tax_id === "ISE" && !l.vatExemptionCode) {
      throw new Error(
        "VAT 0 requires a legal exemption code in InvoiceLine.vatExemptionCode"
      );
    }

    return {
      title: l.description,
      qty: l.quantity,
      gross_price: gross,
      tax_id,
      reference: l.itemRef,
      // Vendus allows tax_exemption_law; we supply it when ISE
      ...(tax_id === "ISE" && l.vatExemptionCode
        ? { tax_exemption_law: l.vatExemptionCode }
        : {}),
    };
  });
}

/** Accept only ISO alpha-2 [A-Z]{2}. */
function normalizeCountry(country?: string): string | undefined {
  if (!country) return undefined;
  const iso = country.toUpperCase().trim();
  if (iso === "PT") return undefined; // omit domestic PT to avoid P006
  if (/^[A-Z]{2}$/.test(iso)) return iso;
  return undefined;
}

/** Minimal client payload (send only what we have). Robust when `input.customer` is missing. */
export function buildClientPayload(input: InvoiceCreateInput) {
  // Many tests pass root-level fields (customerName, customerEmail, customerNIF, etc.)
  // Make this tolerant by reading from `input.customer` first, then falling back to roots.
  const anyInput = input as any;

  const cli = (anyInput.customer ?? {}) as {
    name?: string;
    email?: string;
    nif?: string;
    address?: {
      line1?: string;
      postalCode?: string;
      city?: string;
      country?: string;
    };
  };

  const name =
    cli.name ??
    anyInput.customerName ??
    anyInput.billingCompanyName ??
    anyInput.name ??
    anyInput.email ?? // fallback: use the email as a display name if nothing else
    "Online Customer";

  const email = cli.email ?? anyInput.customerEmail ?? anyInput.email;

  const nif =
    cli.nif ?? anyInput.customerNIF ?? anyInput.billingTaxId ?? anyInput.taxId;

  // Prefer structured `customer.address`, else build from root billing fields
  const addr = cli.address ?? {
    line1: anyInput.billingAddressLine1 ?? anyInput.addressLine1,
    postalCode: anyInput.billingPostalCode ?? anyInput.postalCode,
    city: anyInput.billingCity ?? anyInput.city,
    country: anyInput.billingCountry ?? anyInput.country,
  };

  const country = normalizeCountry(addr?.country);

  return {
    name,
    email,
    fiscal_id: nif, // optional for B2C
    address: addr?.line1,
    postalcode: addr?.postalCode,
    city: addr?.city,
    ...(country ? { country } : {}),
  };
}

/* ----------------- helpers for dynamic field access (type-safe-ish) ----------------- */

/** Small helper to safely read optional properties without asserting a structural type. */
function pick<T = string>(obj: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim?.() !== "") {
      return v as T;
    }
  }
  return undefined;
}

/* ---------------------- robust fallback for missing lines ---------------------- */

/**
 * When callers don't prebuild `input.lines`, derive a single rental line
 * from common booking-ish fields *if present*. This keeps issuance resilient
 * without changing `InvoiceCreateInput`'s structural type.
 */
function fallbackLinesFromInput(input: InvoiceCreateInput) {
  // Dates are optional; we read them dynamically and default quantity to 1
  const startRaw = pick<string | Date>(input, "startDate", "rentalStart");
  const endRaw = pick<string | Date>(input, "endDate", "rentalEnd");

  const start = startRaw ? new Date(startRaw) : undefined;
  const end = endRaw ? new Date(endRaw) : undefined;

  let qty = 1;
  if (
    start &&
    end &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime())
  ) {
    const ms = Math.max(0, end.getTime() - start.getTime());
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    qty = Math.max(1, days);
  }

  const machineName = pick<string>(input, "machineName", "itemTitle");
  const titleParts: string[] = [];
  if (machineName) titleParts.push(String(machineName));
  if (start && end)
    titleParts.push(`rental ${lisbonYmd(start)} → ${lisbonYmd(end)}`);

  const description = titleParts.length ? titleParts.join(" — ") : "Rental";

  const unitPriceCents =
    typeof pick<number>(input, "unitDailyCents", "unitPriceCents") === "number"
      ? (pick<number>(input, "unitDailyCents", "unitPriceCents") as number)
      : 0;

  const vatPercent =
    typeof pick<number>(input, "vatPercent") === "number"
      ? (pick<number>(input, "vatPercent") as number)
      : 23;

  const bookingId = pick<number | string>(input, "bookingId", "id");
  const itemRef =
    input.idempotencyKey ||
    input.externalRef ||
    (bookingId != null ? `booking:${bookingId}` : undefined);

  return [
    {
      description,
      quantity: qty,
      unitPriceCents,
      vatPercent,
      itemRef,
      vatExemptionCode: undefined as string | undefined,
    },
  ];
}

/**
 * Build POST /v1.1/documents/ payload.
 * - docType: "FR" | "FT" | "PF"
 * - mode comes from env (tests/normal) and is included explicitly.
 */
export function buildCreateDocumentPayload(params: {
  docType: DocType;
  registerId: number;
  input: InvoiceCreateInput;
}) {
  const { docType, registerId, input } = params;

  // Prefer explicit lines, otherwise derive a robust fallback
  const sourceLines =
    input.lines && input.lines.length
      ? input.lines
      : fallbackLinesFromInput(input);

  const items = toVendusItems(sourceLines);
  const client = buildClientPayload(input);

  return {
    type: docType, // FR now; FT invoice; PF pro-forma
    mode: MODE, // 'tests' on staging to avoid AT comms
    date: lisbonYmd(input.issuedAt ?? new Date()), // default to "today" if not provided
    register_id: registerId,
    client,
    items, // v1.1 expects items
    external_reference: input.idempotencyKey || input.externalRef,
    notes: input.notes,
    output: "pdf_url",
    return_qrcode: 1,
  };
}
