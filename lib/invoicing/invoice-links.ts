// Purpose: generate customer-facing invoice PDF links using our signed token.

import { createSignedToken } from "@/lib/security/signed-links";

/** Remove trailing slashes to avoid "//api" */
function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

/**
 * Build an absolute URL for the invoice PDF proxy using a provided base URL.
 * Example result:
 *   https://amr.example.com/api/invoices/123/pdf?t=<token>
 */
export function makeInvoicePdfLink(
  baseUrl: string,
  bookingId: number,
  opts?: { ttlSeconds?: number }
): string {
  if (!baseUrl) throw new Error("baseUrl is required");
  if (!Number.isFinite(bookingId)) throw new Error("bookingId must be a number");

  const ttlSeconds = opts?.ttlSeconds ?? 60 * 60 * 72; // default 72h
  const token = createSignedToken({ bid: bookingId }, ttlSeconds);
  const root = stripTrailingSlash(baseUrl);
  return `${root}/api/invoices/${bookingId}/pdf?t=${encodeURIComponent(token)}`;
}

/**
 * Convenience wrapper that resolves base URL from environment.
 * Uses APP_URL, then NEXT_PUBLIC_APP_URL, then Netlify's URL.
 * Enforces https in production if a http URL sneaks in.
 */
export function makeInvoicePdfLinkForEnv(
  bookingId: number,
  opts?: { ttlSeconds?: number }
): string {
  let base =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    "";
  if (!base) {
    throw new Error("No base URL found (APP_URL or NEXT_PUBLIC_APP_URL or URL).");
  }
  if (process.env.NODE_ENV === "production" && base.startsWith("http://")) {
    base = base.replace(/^http:\/\//, "https://");
  }
  return makeInvoicePdfLink(base, bookingId, opts);
}