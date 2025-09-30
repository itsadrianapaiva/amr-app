import { signToken, verifyToken, nowEpoch } from "@/lib/security/hmac";

export type OpsRole = "exec" | "managers";
export const OPS_COOKIE_NAME = "amr_ops";

/** Shape we store in the token payload */
export type OpsSession = {
  sub: string;          // username (e.g., "exec" or "managers")
  role: OpsRole;        // role used for RBAC
  iat: number;          // issued at (epoch seconds)
  exp: number;          // expiry (epoch seconds)
};

/** Resolve secret (throws early so misconfig fails loud in non-prod too) */
function getSecret(): string {
  const s = process.env.AUTH_COOKIE_SECRET;
  if (!s) {
    throw new Error("AUTH_COOKIE_SECRET is not set");
  }
  return s;
}

/** TTL in seconds (default: 7 days) */
function getTtlSeconds(): number {
  const raw = process.env.OPS_SESSION_TTL_SECONDS;
  const n = raw ? Number(raw) : 60 * 60 * 24 * 7;
  return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 24 * 7;
}

/** Create a signed token for the cookie */
export function issueSessionToken(sub: string, role: OpsRole): string {
  const now = nowEpoch();
  const exp = now + getTtlSeconds();
  return signToken({ sub, role, iat: now, exp }, getSecret());
}

/** Verify a token and narrow it to OpsSession if valid */
export function verifySessionToken(token: string):
  | { ok: true; session: OpsSession }
  | { ok: false; error: "malformed" | "bad_signature" | "expired" } {
  const v = verifyToken(token, getSecret());
  if (!v.ok) return v;
  const p = v.payload as Partial<OpsSession>;
  // minimal shape guard
  if (typeof p.sub !== "string" || (p.role !== "exec" && p.role !== "managers") || typeof p.iat !== "number" || typeof p.exp !== "number") {
    return { ok: false, error: "malformed" };
  }
  return { ok: true, session: p as OpsSession };
}

/** Serialize a Set-Cookie string with secure defaults (HttpOnly, Secure, Lax) */
export function serializeSessionCookie(token: string): string {
  const maxAge = getTtlSeconds();
  const parts = [
    `${OPS_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    // In local dev (netlify dev / localhost over http), Secure can block the cookie.
    // Use Secure except when explicitly running in development.
    process.env.NODE_ENV === "development" ? "" : "Secure",
  ].filter(Boolean);
  return parts.join("; ");
}

/** Serialize a Set-Cookie string that expires the cookie immediately */
export function serializeSessionClear(): string {
  const parts = [
    `${OPS_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "development" ? "" : "Secure",
  ].filter(Boolean);
  return parts.join("; ");
}

/** Parse a Cookie header string and return the token (if present) */
export function readSessionTokenFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const c of cookies) {
    if (!c.startsWith(OPS_COOKIE_NAME + "=")) continue;
    const v = c.slice(OPS_COOKIE_NAME.length + 1);
    try {
      return decodeURIComponent(v);
    } catch {
      // fallthrough
    }
  }
  return null;
}
