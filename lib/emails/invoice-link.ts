// Purpose: build a customer-facing invoice download link (URL, text, and HTML)
// for easy inclusion in transactional emails.
// Now prefers the executing request's Host header (when safe) to bind links to
// the deploy that actually sent the email, avoiding cross-environment leaks.

import { headers as nextHeaders } from "next/headers";
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

/** Is the host considered local (keeps http)? */
function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** PROD hosts list used to block prod domains in non-production contexts. */
function getProdHosts(): string[] {
  const raw = process.env.PROD_HOSTS || "amr-rentals.com,www.amr-rentals.com";
  return raw
    .split(/[,\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

/** Should we trust this header host in the current Netlify CONTEXT? */
function headerHostAllowed(host: string): boolean {
  const ctx = (process.env.CONTEXT || "").toLowerCase(); // 'production' | 'branch-deploy' | 'deploy-preview' | etc.
  const prodish = getProdHosts();
  const isProdHost = prodish.some((ph) => host === ph || host.endsWith("." + ph));
  if (ctx === "production") return isProdHost; // in prod, only accept known prod hosts
  // in non-prod, accept header host if it is NOT a prod host
  return !isProdHost;
}

/** Read current request headers (if any) and build a safe absolute base. */
async function getHeaderBoundBase(): Promise<string | undefined> {
  // Will throw if not in a request context; catch and treat as undefined
  let hdrs: Headers | undefined;
  try {
    hdrs = await nextHeaders();
  } catch {
    return undefined;
  }
  const host = (hdrs.get("x-forwarded-host") || hdrs.get("host") || "").toLowerCase();
  if (!host) return undefined;
  if (!headerHostAllowed(host)) return undefined;

  // Prefer x-forwarded-proto from platform; default to https except localhost
  const proto = hdrs.get("x-forwarded-proto") || (isLocalHost(host) ? "http" : "https");
  // Trim trailing slashes from host just in case (rare)
  const cleanHost = host.replace(/\/+$/, "");
  return `${proto}://${cleanHost}`;
}

/**
 * Builds the invoice link and ready-to-use email snippets.
 * Returns: { url, text, html }
 *
 * Resolution order:
 * 1) opts.absoluteBaseUrl (explicit override)
 * 2) header-bound base from the executing request (when safe)
 * 3) environment-based resolver (existing behavior)
 */
export async function buildInvoiceLinkSnippet(
  bookingId: number,
  opts?: InvoiceLinkOptions
): Promise<{ url: string; text: string; html: string }> {
  if (!Number.isFinite(bookingId)) {
    throw new Error("bookingId must be a finite number");
  }

  // 1) Explicit override always wins
  if (opts?.absoluteBaseUrl) {
    const url = makeInvoicePdfLink(opts.absoluteBaseUrl, bookingId, {
      ttlSeconds: opts.ttlSeconds,
    });
    return wrap(url, opts?.invoiceNumber);
  }

  // 2) Try to bind to the real executing host (staging/previews will stay in their lane)
  const headerBase = await getHeaderBoundBase();
  if (headerBase) {
    const url = makeInvoicePdfLink(headerBase, bookingId, {
      ttlSeconds: opts?.ttlSeconds,
    });
    return wrap(url, opts?.invoiceNumber);
  }

  // 3) Fallback to env-based resolution (your current deterministic logic)
  const url = makeInvoicePdfLinkForEnv(bookingId, { ttlSeconds: opts?.ttlSeconds });
  return wrap(url, opts?.invoiceNumber);
}

/* ------------------------------- tiny helpers ------------------------------- */

function wrap(url: string, invoiceNumber?: string) {
  const label =
    invoiceNumber && invoiceNumber.trim().length > 0
      ? `your AMR invoice ${invoiceNumber}`
      : "your AMR invoice";
  const text = `Download ${label}: ${url}`;
  const html = `<p>Download ${escapeHtml(label)}: <a href="${url}">${escapeHtml(
    url
  )}</a></p>`;
  return { url, text, html };
}
