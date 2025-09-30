import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tiny JWT-like HMAC token with base64url parts:
 *   header.payload.signature
 * where signature = HMAC(secret, "header.payload")
 *
 * Header is fixed to keep parsing simple and safe.
 */

export type TokenPayload = Record<string, unknown> & {
  iat?: number; // issued at (epoch seconds)
  exp?: number; // expiry (epoch seconds)
};

type VerifyOk = { ok: true; payload: TokenPayload };
type VerifyErr = { ok: false; error: "malformed" | "bad_signature" | "expired" };

const HEADER = { alg: "HS256", typ: "AMR" };
export const DEFAULT_LEEWAY_SECONDS = 30; // small clock skew tolerance

/** Current epoch seconds. Split for deterministic tests. */
export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

/** base64url encode */
function b64u(input: string | Buffer): string {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return raw.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** base64url decode → Buffer (throws on invalid input) */
function fromB64u(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const norm = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(norm, "base64");
}

/** HS256 HMAC bytes */
function hmac256(data: string, secret: string): Buffer {
  return createHmac("sha256", Buffer.from(secret, "utf8")).update(data).digest();
}

/**
 * Sign a payload.
 * Adds iat if missing. Expiry policy belongs to the session layer.
 */
export function signToken(payload: TokenPayload, secret: string): string {
  const header = b64u(JSON.stringify(HEADER));
  const withIat = { iat: nowEpoch(), ...payload };
  const body = b64u(JSON.stringify(withIat));
  const toSign = `${header}.${body}`;
  const sig = b64u(hmac256(toSign, secret));
  return `${toSign}.${sig}`;
}

/**
 * Verify structure, signature, and optional expiry.
 * Returns typed result for clean branching in callers and tests.
 */
export function verifyToken(token: string, secret: string): VerifyOk | VerifyErr {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "malformed" };
  const [h, p, s] = parts;

  // Header
  try {
    const head = JSON.parse(fromB64u(h).toString("utf8"));
    if (head?.alg !== "HS256" || head?.typ !== "AMR") return { ok: false, error: "malformed" };
  } catch {
    return { ok: false, error: "malformed" };
  }

  // Signature
  try {
    const expected = b64u(hmac256(`${h}.${p}`, secret));
    const a = fromB64u(s);
    const b = fromB64u(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "bad_signature" };
  } catch {
    return { ok: false, error: "malformed" };
  }

  // Payload and expiry
  try {
    const payload = JSON.parse(fromB64u(p).toString("utf8")) as TokenPayload;
    const now = nowEpoch();
    if (typeof payload.exp === "number" && now > payload.exp + DEFAULT_LEEWAY_SECONDS) {
      return { ok: false, error: "expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "malformed" };
  }
}
