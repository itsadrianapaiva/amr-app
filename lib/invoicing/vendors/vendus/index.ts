// lib/invoicing/vendors/vendus/index.ts
import "server-only";
import type {
  InvoicingProvider,
  InvoiceCreateInput,
  InvoiceRecord,
  CreditNoteCreateInput,
  CreditNoteRecord,
  ProviderHealth,
} from "../../provider";
import { BASE_URL, DOC_TYPE, type DocType } from "./core";
import {
  resolveRegisterIdFor,
  assertRegisterCanIssue,
} from "./registers";
import {
  createInvoiceDocument,
  createCreditNoteDocument,
} from "./documents";

/** Read an optional preferred register from env (validated and numeric). */
function preferredRegisterId(): number | null {
  const raw = process.env.VENDUS_REGISTER_ID;
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error("VENDUS_REGISTER_ID must be a number");
  }
  return n;
}

/** Deterministic fallback PDF URL when API doesn’t return pdf_url. */
function directPdfUrl(providerId: string): string {
  return `${BASE_URL}/v1.1/documents/${providerId}.pdf`;
}

export const vendusProvider: InvoicingProvider = {
  async healthCheck(): Promise<ProviderHealth> {
    try {
      const pref = preferredRegisterId();
      const id = await resolveRegisterIdFor(DOC_TYPE as DocType, pref);
      await assertRegisterCanIssue(id, DOC_TYPE as DocType);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: String(e?.message || e) };
    }
  },

  async getInvoicePdf(providerInvoiceId: string): Promise<string> {
    // Prefer API-provided URL elsewhere; this is a stable fallback.
    return directPdfUrl(providerInvoiceId);
  },

  async createInvoice(input: InvoiceCreateInput): Promise<InvoiceRecord> {
    const pref = preferredRegisterId();
    const id = await resolveRegisterIdFor(DOC_TYPE as DocType, pref);
    await assertRegisterCanIssue(id, DOC_TYPE as DocType);
    return createInvoiceDocument({ docType: DOC_TYPE as Exclude<DocType, "NC">, registerId: id, input });
  },

  async createCreditNote(input: CreditNoteCreateInput): Promise<CreditNoteRecord> {
    const pref = preferredRegisterId();
    // Credit notes are fiscal → require open register.
    const id = await resolveRegisterIdFor("NC", pref);
    await assertRegisterCanIssue(id, "NC");
    return createCreditNoteDocument({ registerId: id, input });
  },
};
