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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const nif = searchParams.get("nif");

  // Validate NIF parameter
  if (!nif || nif.trim() === "") {
    return NextResponse.json(
      { error: "Missing or invalid NIF parameter." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // Look up the company discount
    const companyDiscount = await db.companyDiscount.findUnique({
      where: {
        nif: nif.trim(),
      },
    });

    // If found and active, return the discount percentage
    if (companyDiscount && companyDiscount.active) {
      const res = NextResponse.json(
        {
          discountPercentage: Number(companyDiscount.discountPercentage),
          companyName: companyDiscount.companyName,
        },
        { status: 200 }
      );
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // No discount found or inactive
    const res = NextResponse.json(
      { discountPercentage: 0 },
      { status: 200 }
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("Error checking discount:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}