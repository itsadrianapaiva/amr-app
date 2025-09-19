// Purpose: time-limited HMAC-signed tokens for secure public links like invoice PDFs.

import { createHmac, timingSafeEqual } from "node:crypto";

type AnyRecord = Record<string, unknown>;

type SignedPayload<T extends AnyRecord> = T & {
  exp: number; // unix seconds when the token expires
  v: 1; // token version for future-proofing
};

const ALG = "sha256";
const VERSION = 1;

/**
 * Reads the secret used to sign invoice links.
 * Required env: INVOICING_LINK_SECRET
 */
function getSecret(): string {
  const secret = process.env.INVOICING_LINK_SECRET;
  if (!secret || secret.length < 24) {
    // Keep error explicit so we fail loudly in staging if not configured
    throw new Error(
      "Missing INVOICING_LINK_SECRET or too short. Set a long random string in your environment."
    );
  }
  return secret;
}

/**
 * Base64url helpers without padding. Works with Node Buffers.
 */
function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function b64urlDecode(str: string): Buffer {
  const pad = 4 - (str.length % 4 || 4);
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(base64, "base64");
}

/**
 * Creates a compact token "v1.payload.sig".
 * - payload is JSON base64url
 * - sig is hex HMAC over "v1.payload"
 */
export function createSignedToken<T extends AnyRecord>(
  data: T,
  ttlSeconds: number
): string {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be a positive number");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: SignedPayload<T> = {
    ...data,
    exp: now + ttlSeconds,
    v: VERSION,
  };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  const message = `v${VERSION}.${payloadB64}`;
  const sig = createHmac(ALG, getSecret()).update(message).digest("hex");
  return `${message}.${sig}`;
}

/**
 * Verifies token and returns payload if valid and not expired. Otherwise null.
 * Uses timingSafeEqual to avoid subtle timing leaks.
 */
export function verifySignedToken<T extends AnyRecord>(
  token: string
): T | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [ver, payloadB64, sigHex] = parts;
    if (ver !== `v${VERSION}`) return null;

    const message = `${ver}.${payloadB64}`;
    const expected = createHmac(ALG, getSecret()).update(message).digest("hex");

    // Constant time compare. Lengths must match.
    const a = Buffer.from(sigHex, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payloadJson = b64urlDecode(payloadB64).toString("utf8");
    const parsed = JSON.parse(payloadJson) as SignedPayload<T>;
    const now = Math.floor(Date.now() / 1000);
    if (typeof parsed.exp !== "number" || now > parsed.exp) return null;

    // Strip helper fields v and exp before returning as T if desired.
    // Keeping exp can be useful to log remaining time, so we return the full object.
    return parsed as unknown as T;
  } catch {
    return null;
  }
}

/**
 * Helper to compute remaining lifetime in seconds. Useful for logs and UX.
 */
export function secondsUntilExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payloadB64 = parts[1];
  try {
    const payloadJson = b64urlDecode(payloadB64).toString("utf8");
    const parsed = JSON.parse(payloadJson) as { exp?: number };
    if (typeof parsed.exp !== "number") return null;
    return parsed.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}
