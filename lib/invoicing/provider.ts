// Core provider-agnostic types so we can swap vendors without ripple effects.

// ---------- Shared primitives ----------
export type Currency = "EUR";

export type Address = {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: "PT";
};

export type Customer = {
  name: string;
  email?: string;
  nif?: string; // Portuguese VAT number (NIF). Optional for B2C.
  address?: Address;
};

// Each line is integer-cents math for correctness in serverless environments.
export type InvoiceLine = {
  description: string;           // e.g., "Mini-excavator rental — 2 days"
  quantity: number;              // whole units (days, pieces)
  unitPriceCents: number;        // 422500 for €4,225.00
  vatPercent: number;            // 0 | 6 | 13 | 23 typical PT values
  vatExemptionCode?: string;     // Legal code required when vatPercent = 0
  itemRef?: string;              // SKU or Machine ID for reconciliation
};

// Input our mapper will produce from Stripe events / Booking.
// idempotencyKey prevents duplicate docs if webhooks retry.
export type InvoiceCreateInput = {
  idempotencyKey: string; // unique per booking/payment attempt
  externalRef: string;    // Stripe payment_intent or charge id
  issuedAt: Date;         // Europe/Lisbon date we want on the document
  currency: Currency;     // "EUR"
  customer: Customer;
  lines: InvoiceLine[];
  notes?: string;         // optional footer/observations
};

// What we persist back to Booking after a successful create.
export type InvoiceRecord = {
  provider: "vendus";           // narrow literal helps later switches
  providerInvoiceId: string;    // Vendus internal ID
  number: string;               // Human-facing invoice number
  atcud?: string;               // Provider should return this if configured
  pdfUrl: string;               // Stable HTTPS link to the PDF
};

// Credit notes reference the original invoice; lines optional for full-credit.
export type CreditNoteCreateInput = {
  idempotencyKey: string;
  original: Pick<InvoiceRecord, "providerInvoiceId" | "number">;
  reason?: string;
  lines?: InvoiceLine[];        // omit to credit full amount if vendor supports
};

export type CreditNoteRecord = {
  provider: "vendus";
  providerCreditNoteId: string;
  number: string;
  pdfUrl: string;
};

// Health result we can surface in /ops.
export type ProviderHealth = { ok: true } | { ok: false; message: string };

// ---------- Provider interface (to be implemented by vendus.ts) ----------
export interface InvoicingProvider {
  createInvoice(input: InvoiceCreateInput): Promise<InvoiceRecord>;
  createCreditNote(input: CreditNoteCreateInput): Promise<CreditNoteRecord>;
  getInvoicePdf(providerInvoiceId: string): Promise<string>; // returns HTTPS URL
  healthCheck(): Promise<ProviderHealth>;
}
