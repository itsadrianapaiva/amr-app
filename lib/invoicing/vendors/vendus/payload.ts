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
  lines: InvoiceCreateInput["lines"]
): VendusItem[] {
  return lines.map((l) => {
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

/** Minimal client payload (send only what we have). */
export function buildClientPayload(input: InvoiceCreateInput) {
  const cli = input.customer;
  const addr = cli.address;
  const country = normalizeCountry(addr?.country);

  return {
    name: cli.name,
    email: cli.email,
    fiscal_id: cli.nif, // optional for B2C
    address: addr?.line1,
    postalcode: addr?.postalCode,
    city: addr?.city,
    ...(country ? { country } : {}),
  };
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
  const items = toVendusItems(input.lines);
  const client = buildClientPayload(input);

  return {
    type: docType, // FR now; FT invoice; PF pro-forma
    mode: MODE, // 'tests' on staging to avoid AT comms
    date: lisbonYmd(input.issuedAt), // YYYY-MM-DD in Europe/Lisbon
    register_id: registerId,
    client,
    items, // v1.1 expects items
    currency: input.currency, // "EUR"
    external_reference: input.idempotencyKey || input.externalRef,
    notes: input.notes,
    output: "pdf_url",
    return_qrcode: 1,
  };
}
