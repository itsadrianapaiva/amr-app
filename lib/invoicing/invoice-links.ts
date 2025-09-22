// lib/invoicing/invoice-links.ts
// Purpose: generate customer-facing invoice PDF links using our signed token.
// This version fixes Netlify env resolution and expands "$deploy_prime_url" style placeholders,
// and normalizes against accidental double protocols like "http://http://host".

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

/** Is the host considered local (keeps http)? */
function isLocalHost(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}

/**
 * Normalize a possibly placeholder-containing base URL to:
 *  - expand $VARS from env
 *  - strip any leading protocol(s) (handles "http://http://host")
 *  - re-apply scheme: http for local, https for everything else
 *  - trim trailing slashes
 *
 * Accepts inputs like:
 *  - "http://$deploy_prime_url"
 *  - "$DEPLOY_PRIME_URL"
 *  - "amr.example.com"
 *  - "https://amr.example.com/"
 */
function normalizeBaseUrl(raw: string): string {
  let s = (raw || "").trim();
  if (!s) throw new Error("Empty base URL");

  // 1) Expand placeholders (e.g., "$deploy_prime_url")
  if (s.includes("$")) s = expandPlaceholders(s);

  // 2) Remove any number of leading protocols, e.g., "http://http://host"
  s = s.replace(/^(https?:\/\/)+/i, "");

  // 3) Decide scheme based on host (keep path/port after host intact)
  //    Extract the host portion before first slash
  const firstSlash = s.indexOf("/");
  const host = firstSlash === -1 ? s : s.slice(0, firstSlash);
  const scheme = isLocalHost(host) ? "http://" : "https://";

  // 4) Rebuild and strip trailing slash(es)
  const rebuilt = scheme + s.replace(/\/+$/, "");
  return stripTrailingSlash(rebuilt);
}

/** Resolve a sensible base URL from environment in this order. */
function resolveBaseUrlFromEnv(): string {
  // Preferred explicit app URLs
  const baseCandidate =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    // Netlify-provided URLs
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    "";

  if (!baseCandidate)
    throw new Error(
      "No base URL found (APP_URL, NEXT_PUBLIC_APP_URL, URL, DEPLOY_PRIME_URL, or DEPLOY_URL)."
    );

  return normalizeBaseUrl(baseCandidate);
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
  const root = stripTrailingSlash(normalizeBaseUrl(baseUrl));
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
