/**
 * Universal session helpers for the ops dashboard.
 * - No Next.js imports; safe in Edge and Node.
 * - Issues and verifies an HMAC-SHA256 signed token stored in an HttpOnly cookie.
 *
 * Cookie: amr_ops = base64url(JSON).base64url(HMAC)
 * Payload fields: { sub: string, role: string, iat: number, exp: number }
 */

import { signToken, verifyToken } from "@/lib/security/hmac";

export const SESSION_COOKIE = "amr_ops";
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type SessionClaims = {
  sub: string;
  role: string; // "exec" | "managers" (string to allow future roles)
  iat?: number;
  exp?: number;
};

type VerifyResult =
  | { ok: true; session: Required<SessionClaims> }
  | { ok: false; reason: string };

/** Minimal cookie serializer (no dependencies). */
function serializeCookie(
  name: string,
  value: string,
  opts: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
    maxAge?: number; // seconds
    expires?: Date;
  } = {}
): string {
  const p: string[] = [`${name}=${value}`];

  if (opts.maxAge != null) p.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  if (opts.expires) p.push(`Expires=${opts.expires.toUTCString()}`);
  p.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly) p.push("HttpOnly");
  if (opts.secure) p.push("Secure");
  p.push(`SameSite=${opts.sameSite ?? "Lax"}`);

  return p.join("; ");
}

/** Parse a Cookie header into a map. */
function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    // Cookie values may be quoted; we keep as-is because our token is base64url.
    out[name] = val;
  }
  return out;
}

/** Build the cookie header string to set a new session. */
export async function issueSessionCookie(args: {
  sub: string;
  role: string;
  secret: string; // AUTH_COOKIE_SECRET
  ttlSeconds?: number;
}): Promise<string> {
  const { sub, role, secret, ttlSeconds = DEFAULT_TTL_SECONDS } = args;

  const token = await signToken({ sub, role }, secret, ttlSeconds);

  const secure = process.env.NODE_ENV === "production";
  const expires = new Date(Date.now() + ttlSeconds * 1000);

  return serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: ttlSeconds,
    expires,
  });
}

/** Build the cookie header string to clear the session. */
export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production";
  // Expire in the past to prompt deletion in all browsers.
  const expires = new Date(0);
  return serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    expires,
  });
}

/**
 * Verify and decode the session from a raw Cookie header.
 * Returns a discriminated union to simplify call sites (middleware, routes).
 */
export async function verifySessionFromCookie(
  cookieHeader: string | null | undefined,
  secret: string
): Promise<VerifyResult> {
  const jar = parseCookieHeader(cookieHeader);
  const token = jar[SESSION_COOKIE];
  if (!token) return { ok: false, reason: "Missing cookie" };

  const res = await verifyToken<SessionClaims>(token, secret);
  if (!res.ok) return { ok: false, reason: res.reason };

  const { sub, role, iat, exp } = res.payload;

  if (typeof sub !== "string" || !sub) return { ok: false, reason: "Invalid sub" };
  if (typeof role !== "string" || !role) return { ok: false, reason: "Invalid role" };
  if (typeof iat !== "number" || typeof exp !== "number") return { ok: false, reason: "Missing times" };

  return { ok: true, session: { sub, role, iat, exp } };
}

/**
 * Helper to decide if auth is disabled (staging/previews smoke).
 * This keeps the flag logic colocated with session utils.
 */
export function isAuthDisabled(): boolean {
  return process.env.OPS_DISABLE_AUTH === "1";
}

/**
 * Helper to decide if the ops dashboard is enabled.
 * Used by middleware and API routes to quickly short-circuit.
 */
export function isOpsDashboardEnabled(): boolean {
  return process.env.OPS_DASHBOARD_ENABLED === "1";
}
