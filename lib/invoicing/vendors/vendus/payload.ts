import "server-only";
import type { DocType } from "./core";
import { MODE, lisbonYmd, mapVatToTaxId } from "./core";
import type { InvoiceCreateInput } from "../../provider";

/**
 * Vendus "product" line (subset).
 * - price is NET (ex-VAT) per Vendus API when using tax_id.
 */
export type VendusProduct = {
  name: string;
  qty: number;
  price: number; // net unit price (EUR) with 2 decimals
  tax_id: "NOR" | "INT" | "RED" | "ISE";
  exemption_reason?: string;
  reference?: string;
};

/** Transform provider-agnostic lines into Vendus products (net pricing). */
export function toVendusProducts(
  lines: InvoiceCreateInput["lines"]
): VendusProduct[] {
  return lines.map((l) => {
    const price = Number((l.unitPriceCents / 100).toFixed(2)); // net
    const tax_id = mapVatToTaxId(l.vatPercent);
    if (tax_id === "ISE" && !l.vatExemptionCode) {
      throw new Error(
        "VAT 0 requires a legal exemption code in InvoiceLine.vatExemptionCode"
      );
    }
    return {
      name: l.description,
      qty: l.quantity,
      price,
      tax_id,
      exemption_reason: l.vatExemptionCode,
      reference: l.itemRef,
    };
  });
}

/** Accept only ISO alpha-2 [A-Z]{2}. */
function normalizeCountry(country?: string): string | undefined {
  if (!country) return undefined;
  const iso = country.toUpperCase().trim();
  // Domestic PT is safe to omit - Vendus will default it correctly for most accounts
  if (iso === "PT") return undefined;
  // Keep a conservative allowlist to avoid P006 - expand as needed
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
    // country only when valid and non-PT to avoid Vendus P006
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
  const products = toVendusProducts(input.lines);
  const client = buildClientPayload(input);

  return {
    type: docType, // FR money received now; FT invoice before payment; PF pro-forma
    mode: MODE, // 'tests' by default to avoid AT comms
    date: lisbonYmd(input.issuedAt), // YYYY-MM-DD in Europe/Lisbon
    register_id: registerId,
    client,
    products,
    currency: input.currency, // "EUR"
    external_reference: input.idempotencyKey || input.externalRef,
    notes: input.notes,
    output: "pdf_url",
    return_qrcode: 1,
  };
}
