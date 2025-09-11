// Node runtime + no caching (dev-only helper)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { isInsideServiceArea, SERVICE_AREA_NAME } from "@/lib/geo/service-area";

/**
 * GET /api/dev/geofence-check?lat=<number>&lng=<number>
 * Dev-only helper: returns { inside: boolean, serviceArea: string }.
 * Hard-forbidden on production environments.
 *
 * Examples:
 *   /api/dev/geofence-check?lat=37.02&lng=-7.92   // Faro-ish → IN
 *   /api/dev/geofence-check?lat=37.03&lng=-7.80   // Olhão-ish → OUT
 */

function parseNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  // Guard: never expose this helper on prod
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Forbidden on production." },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const lat = parseNumber(searchParams.get("lat"));
  const lng = parseNumber(searchParams.get("lng"));

  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lng query params." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const inside = isInsideServiceArea(lat, lng);
  const res = NextResponse.json(
    {
      inside,
      serviceArea: SERVICE_AREA_NAME,
      echo: { lat, lng },
    },
    { status: 200 }
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
