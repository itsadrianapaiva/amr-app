// Purpose: build a customer-facing invoice download link (URL, text, and HTML)
// for easy inclusion in transactional emails.

import {
    makeInvoicePdfLink,
    makeInvoicePdfLinkForEnv,
  } from "@/lib/invoicing/invoice-links";
  
  /** Minimal HTML escaper to prevent accidental injection from invoice numbers, etc. */
  function escapeHtml(s: string): string {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  
  export type InvoiceLinkOptions = {
    /** Optional, if you want to show "Invoice FT-2025-000123" in copy. */
    invoiceNumber?: string;
    /** Override the default 72h TTL for the signed link. */
    ttlSeconds?: number;
    /** If provided, forces this base URL (useful in tests or special contexts). */
    absoluteBaseUrl?: string;
  };
  
  /**
   * Builds the invoice link and ready-to-use email snippets.
   * Returns: { url, text, html }
   */
  export function buildInvoiceLinkSnippet(
    bookingId: number,
    opts?: InvoiceLinkOptions
  ): { url: string; text: string; html: string } {
    if (!Number.isFinite(bookingId)) {
      throw new Error("bookingId must be a finite number");
    }
  
    const url = opts?.absoluteBaseUrl
      ? makeInvoicePdfLink(opts.absoluteBaseUrl, bookingId, {
          ttlSeconds: opts?.ttlSeconds,
        })
      : makeInvoicePdfLinkForEnv(bookingId, { ttlSeconds: opts?.ttlSeconds });
  
    const label =
      opts?.invoiceNumber && opts.invoiceNumber.trim().length > 0
        ? `your AMR invoice ${opts.invoiceNumber}`
        : "your AMR invoice";
  
    const text = `Download ${label}: ${url}`;
    const html = `<p>Download ${escapeHtml(
      label
    )}: <a href="${url}">${escapeHtml(url)}</a></p>`;
  
    return { url, text, html };
  }
  