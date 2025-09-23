// lib/invoicing/invoice-links.ts
// Purpose: generate customer-facing invoice PDF links using our signed token.
// Context-aware Netlify selection so staging/previews never use the production domain.

import { createSignedToken } from "@/lib/security/signed-links";

/** Remove trailing slashes to avoid "//api" */
function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

/** Expand "$VAR" placeholders using process.env (case-insensitive). Empty → undefined. */
function expandPlaceholdersOrUndef(input?: string): string | undefined {
  if (!input) return undefined;
  const out = input
    .replace(/\$([A-Za-z0-9_]+)/g, (_, name: string) => {
      const key = name.toUpperCase(); // Netlify envs are uppercase
      const val = process.env[key];
      return typeof val === "string" ? val : "";
    })
    .trim();
  return out.length > 0 ? out : undefined;
}

/** Is the host considered local (keeps http)? */
function isLocalHost(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}

/** Get hostname from a possibly scheme-less string */
function asHostname(s: string): string {
  try {
    const url = /^https?:\/\//i.test(s) ? new URL(s) : new URL(`https://${s}`);
    return url.hostname;
  } catch {
    return s;
  }
}

/**
 * Normalize a base URL to:
 *  - strip stacked protocols ("http://http://...")
 *  - ensure scheme (http for local, https otherwise)
 *  - trim trailing slash
 */
function normalizeBaseUrl(raw: string): string {
  let s = (raw || "").trim();
  if (!s) throw new Error("Empty base URL");

  // Remove any number of leading protocols, e.g., "http://http://host"
  s = s.replace(/^(https?:\/\/)+/i, "");

  // Decide scheme based on host
  const host = s.split("/")[0]!;
  const scheme = isLocalHost(host) ? "http://" : "https://";

  return stripTrailingSlash(scheme + s);
}

/**
 * Context-aware resolution for Netlify:
 * - In production (CONTEXT === "production"): prefer explicit app URLs, then Netlify URL fallbacks.
 * - In non-production (branch-deploy / deploy-preview): prefer DEPLOY_PRIME_URL or URL,
 *   and ignore production-looking APP_URL to avoid amr-rentals.com leaking into staging.
 */
function resolveBaseUrlFromEnv(): string {
  const CONTEXT = (process.env.CONTEXT || "").toLowerCase(); // 'production' | 'branch-deploy' | 'deploy-preview' | etc.
  const APP_URL = expandPlaceholdersOrUndef(process.env.APP_URL);
  const NEXT_PUBLIC_APP_URL = expandPlaceholdersOrUndef(
    process.env.NEXT_PUBLIC_APP_URL
  );
  const URL = expandPlaceholdersOrUndef(process.env.URL); // Netlify site URL for this deploy
  const DEPLOY_PRIME_URL = expandPlaceholdersOrUndef(
    process.env.DEPLOY_PRIME_URL
  ); // preview/branch
  const DEPLOY_URL = expandPlaceholdersOrUndef(process.env.DEPLOY_URL);

  // Helper: first non-empty from a list
  const first = (...xs: Array<string | undefined>) => xs.find(Boolean);

  if (CONTEXT === "production") {
    const candidate = first(
      APP_URL,
      NEXT_PUBLIC_APP_URL,
      URL,
      DEPLOY_PRIME_URL,
      DEPLOY_URL
    );
    if (candidate) return normalizeBaseUrl(candidate);
    throw new Error("No usable base URL in production context.");
  }

  // Non-production: prefer per-deploy URLs
  const candidate = first(
    DEPLOY_PRIME_URL,
    URL,
    DEPLOY_URL,
    APP_URL,
    NEXT_PUBLIC_APP_URL
  );
  if (candidate) return normalizeBaseUrl(candidate);

  throw new Error("No usable base URL (non-production).");
}

/**
 * Build an absolute URL for the invoice PDF proxy using a provided base URL.
 * Example:
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
  const root = normalizeBaseUrl(baseUrl);
  return `${root}/api/invoices/${bookingId}/pdf?t=${encodeURIComponent(token)}`;
}

/**
 * Convenience wrapper that resolves base URL from environment.
 * Uses Netlify CONTEXT to avoid staging emails pointing at production.
 */
export function makeInvoicePdfLinkForEnv(
  bookingId: number,
  opts?: { ttlSeconds?: number }
): string {
  const base = resolveBaseUrlFromEnv();
  return makeInvoicePdfLink(base, bookingId, opts);
}
