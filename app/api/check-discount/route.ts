// Node runtime + no caching (customer-facing API)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/check-discount?nif=<string>
 *
 * Checks if a company NIF has an active discount.
 * Returns { discountPercentage: number } where 0 means no discount.
 *
 * Examples:
 *   /api/check-discount?nif=123456789   // Returns discount if found
 *   /api/check-discount?nif=999999999   // Returns 0 if not found
 */

// ---------------------------------------------------------------------------
// Rate limiting (best-effort, per-instance)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const RATE_LIMIT_MAX = 30; // max requests per window per IP

type RateLimitEntry = { count: number; resetAtMs: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  // Netlify-specific header
  const nfIp = req.headers.get("x-nf-client-connection-ip");
  if (nfIp) return nfIp.trim();

  // Standard forwarded header (first value)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
  count?: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAtMs) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAtMs: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, count: 1 };
  }

  // Existing window
  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.resetAtMs - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds, count: entry.count };
  }

  return { allowed: true, count: entry.count };
}

// ---------------------------------------------------------------------------

/**
 * Normalize and validate NIF: remove non-digits, ensure exactly 9 digits.
 * Returns normalized NIF or null if invalid.
 */
function normalizeAndValidateNIF(nif: string | null): string | null {
  if (!nif) return null;
  const digits = nif.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const nif = searchParams.get("nif");

  // Rate limiting (checked before validation or DB call)
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);

  if (!rateCheck.allowed) {
    // Mask NIF for logging: show only last 3 digits if present and long enough
    const maskedNif = nif && nif.length >= 3 ? `***${nif.slice(-3)}` : "none";
    const reqId = req.headers.get("x-nf-request-id") ?? "-";
    console.warn(
      `[rate-limit:check-discount] ip=${clientIp} reqId=${reqId} nif=${maskedNif} count=${rateCheck.count} limit=${RATE_LIMIT_MAX}`
    );

    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateCheck.retryAfterSeconds),
        },
      }
    );
  }

  // Normalize and validate NIF parameter
  const normalizedNIF = normalizeAndValidateNIF(nif);
  if (!normalizedNIF) {
    return NextResponse.json(
      { error: "Invalid NIF parameter." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // TEMPORARY: DB safety instrumentation (remove after staging verification)
    const reqId = req.headers.get("x-nf-request-id") ?? "-";
    const nifMasked = `***${normalizedNIF.slice(-3)}`;
    console.log("[check-discount] db query start", { reqId, ip: clientIp, nifMasked });

    // Look up the company discount using normalized NIF
    const companyDiscount = await db.companyDiscount.findUnique({
      where: {
        nif: normalizedNIF,
      },
    });

    // Cache headers for successful responses (5 min TTL, 1 min stale-while-revalidate)
    const cacheHeaders = {
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
    };

    // If found and active, return the discount percentage
    if (companyDiscount && companyDiscount.active) {
      return NextResponse.json(
        {
          discountPercentage: Number(companyDiscount.discountPercentage),
          companyName: companyDiscount.companyName,
        },
        { status: 200, headers: cacheHeaders }
      );
    }

    // No discount found or inactive
    return NextResponse.json(
      { discountPercentage: 0 },
      { status: 200, headers: cacheHeaders }
    );
  } catch (error) {
    console.error("Error checking discount:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}