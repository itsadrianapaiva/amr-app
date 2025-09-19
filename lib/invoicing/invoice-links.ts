// lib/invoicing/invoice-links.ts
// Purpose: generate customer-facing invoice PDF links using our signed token.
// This version fixes Netlify env resolution and expands "$deploy_prime_url" style placeholders.

import { createSignedToken } from "@/lib/security/signed-links";

/** Remove trailing slashes to avoid "//api" */
function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

/** Expand "$var" placeholders using process.env (case-insensitive). */
function expandPlaceholders(input: string): string {
  return input.replace(/\$([A-Za-z0-9_]+)/g, (_, name: string) => {
    const key = name.toUpperCase(); // Netlify envs are uppercase
    const val = process.env[key];
    return typeof val === "string" && val.length > 0 ? val : `$${name}`; // leave as-is if unknown
  });
}

/** Resolve a sensible base URL from environment in this order. */
function resolveBaseUrlFromEnv(): string {
  // Preferred explicit app URLs
  let base =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    // Netlify-provided URLs
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    "";

  if (!base)
    throw new Error(
      "No base URL found (APP_URL, NEXT_PUBLIC_APP_URL, URL, DEPLOY_PRIME_URL, or DEPLOY_URL)."
    );

  // Expand "$deploy_prime_url" or similar placeholders if someone set APP_URL="http://$deploy_prime_url"
  if (base.includes("$")) {
    base = expandPlaceholders(base);
  }

  // If someone provided just a host (no scheme), normalize
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }

  // Enforce https for non-local hosts
  if (base.startsWith("http://") && !/localhost|127\.0\.0\.1/i.test(base)) {
    base = base.replace(/^http:\/\//i, "https://");
  }

  return stripTrailingSlash(base);
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
  if (!Number.isFinite(bookingId))
    throw new Error("bookingId must be a number");

  const ttlSeconds = opts?.ttlSeconds ?? 60 * 60 * 72; // default 72h
  const token = createSignedToken({ bid: bookingId }, ttlSeconds);
  const root = stripTrailingSlash(baseUrl);
  return `${root}/api/invoices/${bookingId}/pdf?t=${encodeURIComponent(token)}`;
}

/**
 * Convenience wrapper that resolves base URL from environment.
 * Uses APP_URL, NEXT_PUBLIC_APP_URL, then Netlify's URL/DEPLOY_* variables.
 * Expands "$deploy_prime_url" style placeholders when present.
 */
export function makeInvoicePdfLinkForEnv(
  bookingId: number,
  opts?: { ttlSeconds?: number }
): string {
  const base = resolveBaseUrlFromEnv();
  return makeInvoicePdfLink(base, bookingId, opts);
}
