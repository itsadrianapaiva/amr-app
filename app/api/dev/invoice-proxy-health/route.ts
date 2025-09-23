import { NextResponse } from "next/server";
import crypto from "crypto";

// Optional but useful to avoid caching in any env
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dev-only health for invoice proxy plumbing.
 * - Guarded by x-e2e-secret.
 * - Reports base URL resolution and secret status.
 * - Mints a sample v1 token for a given bookingId to check shape.
 *
 * Query:
 *   ?bookingId=338            // optional; defaults to "test-001"
 *   ?ttlSeconds=900           // optional; default 900s
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const hdr = req.headers.get("x-e2e-secret");
  const need = process.env.E2E_SECRET;
  if (!need || hdr !== need) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Inputs
  const bookingId = url.searchParams.get("bookingId") ?? "test-001";
  const ttlSeconds = Math.max(
    60,
    Number(url.searchParams.get("ttlSeconds") ?? 900)
  );

  // Resolve base URL similarly to our link builder
  const appUrl = resolveAppUrl();

  // Secret status (do not echo secret)
  const secret = process.env.INVOICING_LINK_SECRET ?? "";
  const secretPresent = Boolean(secret);
  const secretLength = secret.length;

  // Build a sample v1 token to check shape; verify it with the same inline logic here.
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayloadV1 = {
    bid: bookingId,
    exp: now + ttlSeconds,
    v: 1,
  }; // <- typed (fixes TS2345)
  const t = mintTokenV1(payload, secret);
  const verify = verifyTokenV1(t, secret);

  // Compose a sample public link (this health’s signature scheme).
  const sampleLink = appUrl
    ? `${appUrl}/api/invoices/${encodeURIComponent(bookingId)}/pdf?t=${encodeURIComponent(t)}`
    : null;

  return NextResponse.json({
    ok: true,
    nowIso: new Date().toISOString(),
    appUrl,
    envKeysUsed: usedEnvKeys(), // returns string[] (fixes TS2322)
    secretPresent,
    secretLength,
    bookingId,
    token: {
      preview: t.slice(0, 20) + "..." + t.slice(-12),
      length: t.length,
      verify,
    },
    sampleInvoiceLink: sampleLink,
    notes: [
      "sampleInvoiceLink is only for shape testing from this health route",
      "If your production proxy verifies tokens differently, this may not open",
      "Next step: if appUrl and secret look correct but 404 persists, we will add structured logs to /api/invoices/[bookingId]/pdf",
    ],
  });
}

/* ------------------------- helpers (small, focused) ------------------------- */

type TokenPayloadV1 = { bid: string; exp: number; v: 1 };

function resolveAppUrl(): string | null {
  let base =
    expandPlaceholder(process.env.APP_URL) ??
    expandPlaceholder(process.env.NEXT_PUBLIC_APP_URL) ??
    expandPlaceholder(process.env.URL) ??
    expandPlaceholder(process.env.DEPLOY_PRIME_URL) ??
    expandPlaceholder(process.env.DEPLOY_URL) ??
    undefined;

  if (!base) return null;

  base = base.trim();
  // Remove accidental double protocols like "https://https://..."
  base = base.replace(/^https?:\/\/https?:\/\//i, "https://");

  // Add scheme if missing
  if (!/^https?:\/\//i.test(base)) base = "https://" + base;

  // Enforce https for non-local
  if (!isLocal(base)) base = base.replace(/^http:\/\//i, "https://");

  // Trim trailing slash
  base = base.replace(/\/+$/, "");
  return base || null;
}

function isLocal(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

function expandPlaceholder(v?: string): string | undefined {
  if (!v) return undefined;
  // Expand common Netlify-style placeholders (case-insensitive).
  const expanded = v
    .replace(/\$url/gi, process.env.URL ?? "")
    .replace(/\$deploy_prime_url/gi, process.env.DEPLOY_PRIME_URL ?? "")
    .replace(/\$deploy_url/gi, process.env.DEPLOY_URL ?? "");

  const trimmed = expanded.trim();
  // CRITICAL: treat empty string as undefined so caller can fall back.
  return trimmed.length > 0 ? trimmed : undefined;
}

function usedEnvKeys(): string[] {
  const keys = [
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "URL",
    "DEPLOY_PRIME_URL",
    "DEPLOY_URL",
    "INVOICING_LINK_SECRET",
  ] as const;
  // Narrow to those present and return as string[]
  return keys.filter((k) => Boolean(process.env[k])).map((k) => k as string);
}

function mintTokenV1(p: TokenPayloadV1, secret: string): string {
  const version = "v1";
  const payload = base64url(JSON.stringify(p));
  const sig = hmacSha256Hex(`${version}.${payload}`, secret);
  return `${version}.${payload}.${sig}`;
}

function verifyTokenV1(
  t: string,
  secret: string
): { valid: boolean; reason?: string } {
  const [version, payload, sig] = t.split(".");
  if (version !== "v1" || !payload || !sig)
    return { valid: false, reason: "bad-shape" };
  const expected = hmacSha256Hex(`${version}.${payload}`, secret);
  if (!timingSafeEq(sig, expected))
    return { valid: false, reason: "bad-signature" };
  try {
    const p = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8")
    ) as TokenPayloadV1;
    const now = Math.floor(Date.now() / 1000);
    if (p.exp <= now) return { valid: false, reason: "expired" };
    if (!String(p.bid)) return { valid: false, reason: "bad-payload" };
    return { valid: true };
  } catch {
    return { valid: false, reason: "decode-error" };
  }
}

function base64url(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function hmacSha256Hex(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function timingSafeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
