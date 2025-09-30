// lib/security/hmac.ts
/**
 * Universal HMAC utilities using Web Crypto (Node 20+ and Edge).
 * No "node:crypto" imports. Safe for middleware and server runtimes.
 */

type SignedPayload = Record<string, unknown> & {
  iat?: number;
  exp?: number;
};

const subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle;

/** Asserts Web Crypto availability early to avoid silent runtime traps. */
function ensureSubtle(): SubtleCrypto {
  if (!subtle) {
    throw new Error(
      "Web Crypto not available. Use Node 20+ or an environment that exposes globalThis.crypto.subtle."
    );
  }
  return subtle;
}

/** UTF-8 encode string to bytes. */
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Base64url encode bytes without padding. */
function b64urlFromBytes(bytes: Uint8Array): string {
  // Prefer Buffer in Node, btoa in Edge/browser workers.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa expects Latin1. Our bytes are raw, so this is OK.
  const base64 = btoa(bin);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Base64url encode a UTF-8 string. */
function b64urlFromUtf8(s: string): string {
  return b64urlFromBytes(utf8(s));
}

/** Base64url decode to bytes. */
function bytesFromB64url(s: string): Uint8Array {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Constant-time equality for MAC comparison. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a[i] ^ b[i];
  return res === 0;
}

/** Import HMAC key from a UTF-8 secret string. */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const s = ensureSubtle();
  return s.importKey("raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Compute HMAC SHA-256 over an input string. Returns raw bytes. */
async function hmacSha256(input: string, secret: string): Promise<Uint8Array> {
  const s = ensureSubtle();
  const key = await importHmacKey(secret);
  const sig = await s.sign("HMAC", key, utf8(input));
  return new Uint8Array(sig);
}

/**
 * Sign a JSON payload with HMAC SHA-256.
 * Token format: base64url(JSON).base64url(signature)
 * iat and exp are added if missing. exp = iat + ttlSeconds.
 */
export async function signToken(
  payload: SignedPayload,
  secret: string,
  ttlSeconds = 7 * 24 * 60 * 60
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const withTimes: SignedPayload = {
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + ttlSeconds,
    ...payload,
  };
  const json = JSON.stringify(withTimes);
  const body = b64urlFromUtf8(json);
  const sigBytes = await hmacSha256(body, secret);
  const sig = b64urlFromBytes(sigBytes);
  return `${body}.${sig}`;
}

/**
 * Verify a token and return its JSON payload if valid and not expired.
 * Returns a discriminated union for ergonomic checks.
 */
export async function verifyToken<T extends SignedPayload>(
  token: string,
  secret: string
): Promise<{ ok: true; payload: T } | { ok: false; reason: string }> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "Malformed token" };

  const body = token.slice(0, dot);
  const sigProvided = token.slice(dot + 1);

  // Verify MAC.
  const sigExpectedBytes = await hmacSha256(body, secret);
  const sigProvidedBytes = bytesFromB64url(sigProvided);
  if (!constantTimeEqual(sigExpectedBytes, sigProvidedBytes)) {
    return { ok: false, reason: "Invalid signature" };
  }

  // Parse payload and check exp.
  try {
    const jsonBytes = bytesFromB64url(body);
    const json = new TextDecoder().decode(jsonBytes);
    const payload = JSON.parse(json) as T;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && now > payload.exp) {
      return { ok: false, reason: "Token expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "Invalid payload" };
  }
}
