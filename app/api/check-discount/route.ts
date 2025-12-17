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

  // Normalize and validate NIF parameter
  const normalizedNIF = normalizeAndValidateNIF(nif);
  if (!normalizedNIF) {
    return NextResponse.json(
      { error: "Invalid NIF parameter." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
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