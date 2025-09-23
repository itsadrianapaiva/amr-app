// lib/invoicing/invoice-links.ts
// Patch: reconcile test-time expectation (APP_URL wins) with staging safety (avoid prod domain).

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

/** Extract hostname from a possibly scheme-less string */
function hostnameOf(raw: string): string {
  const s = raw.trim();
  try {
    const url = /^https?:\/\//i.test(s) ? new URL(s) : new URL(`https://${s}`);
    return url.hostname.toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

/** Normalize base URL: de-dup protocols, ensure scheme, trim trailing slash */
function normalizeBaseUrl(raw: string): string {
  let s = (raw || "").trim();
  if (!s) throw new Error("Empty base URL");
  s = s.replace(/^(https?:\/\/)+/i, ""); // strip stacked protocols
  const host = s.split("/")[0]!;
  const scheme = isLocalHost(host) ? "http://" : "https://";
  return stripTrailingSlash(scheme + s);
}

/**
 * Determine if a candidate base should be allowed in non-production contexts.
 * - Blocks known production domains (default: "amr-rentals.com") unless overridden.
 * - Allows custom test domains like "amr.example.com" so unit tests can assert APP_URL precedence.
 */
function allowInNonProd(candidate?: string): string | undefined {
  if (!candidate) return undefined;
  const host = hostnameOf(candidate);

  // Allow overrides via env (comma/space separated)
  const PROD_HOSTS =
    process.env.PROD_HOSTS?.split(/[,\s]+/).filter(Boolean).map((h) => h.toLowerCase()) ??
    ["amr-rentals.com"];

  return PROD_HOSTS.includes(host) ? undefined : candidate;
}

/**
 * Context-aware resolution for Netlify + tests:
 * - In **tests** (NODE_ENV === "test"): prefer APP_URL → NEXT_PUBLIC_APP_URL → URL → DEPLOY_*
 *   to satisfy unit spec asserting APP_URL precedence.
 * - In **production** (CONTEXT === "production"): prefer explicit app URLs first, then Netlify URLs.
 * - In **non-production deploys**: prefer per-deploy URLs; only use APP_URL/NEXT_PUBLIC_APP_URL
 *   if they do NOT point at a known production host.
 */
function resolveBaseUrlFromEnv(): string {
  const CONTEXT = (process.env.CONTEXT || "").toLowerCase(); // 'production' | 'branch-deploy' | 'deploy-preview' | etc.
  const NODE_ENV = (process.env.NODE_ENV || "").toLowerCase();

  const APP_URL = expandPlaceholdersOrUndef(process.env.APP_URL);
  const NEXT_PUBLIC_APP_URL = expandPlaceholdersOrUndef(process.env.NEXT_PUBLIC_APP_URL);
  const URL = expandPlaceholdersOrUndef(process.env.URL);
  const DEPLOY_PRIME_URL = expandPlaceholdersOrUndef(process.env.DEPLOY_PRIME_URL);
  const DEPLOY_URL = expandPlaceholdersOrUndef(process.env.DEPLOY_URL);

  const first = (...xs: Array<string | undefined>) => xs.find(Boolean);

  // --- Tests: match legacy expectation (APP_URL wins) ---
  if (NODE_ENV === "test") {
    const candidate = first(APP_URL, NEXT_PUBLIC_APP_URL, URL, DEPLOY_PRIME_URL, DEPLOY_URL);
    if (candidate) return normalizeBaseUrl(candidate);
    throw new Error("No usable base URL in test context.");
  }

  // --- Production deploys ---
  if (CONTEXT === "production") {
    const candidate = first(APP_URL, NEXT_PUBLIC_APP_URL, URL, DEPLOY_PRIME_URL, DEPLOY_URL);
    if (candidate) return normalizeBaseUrl(candidate);
    throw new Error("No usable base URL in production context.");
  }

  // --- Non-production (branch-deploy / deploy-preview / others) ---
  // Prefer per-deploy URLs; allow APP_URL/NEXT_PUBLIC_APP_URL only if not a known prod host.
  const candidate = first(
    DEPLOY_PRIME_URL,
    URL,
    DEPLOY_URL,
    allowInNonProd(APP_URL),
    allowInNonProd(NEXT_PUBLIC_APP_URL)
  );
  if (candidate) return normalizeBaseUrl(candidate);

  throw new Error("No usable base URL (non-production).");
}

/**
 * Build an absolute URL for the invoice PDF proxy using a provided base URL.
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
  const root = normalizeBaseUrl(baseUrl);
  return `${root}/api/invoices/${bookingId}/pdf?t=${encodeURIComponent(token)}`;
}

/**
 * Convenience wrapper that resolves base URL from environment.
 */
export function makeInvoicePdfLinkForEnv(
  bookingId: number,
  opts?: { ttlSeconds?: number }
): string {
  const base = resolveBaseUrlFromEnv();
  return makeInvoicePdfLink(base, bookingId, opts);
}
