// Node runtime (Prisma) + no caching
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { getCronSecret } from "@/lib/cron/secret";

/**
 * Auth matrix:
 * - Netlify Scheduled Function: send header "x-cron-secret: <CRON_SECRET>"
 * - Vercel Cron: header "x-vercel-cron: 1" (kept for portability)
 * - Manual fallback: query string ?token=<CRON_SECRET>
 */
function isAuthorized(req: NextRequest): boolean {
  // Accept Vercel's built-in cron header (if ever used)
  if (req.headers.get("x-vercel-cron") === "1") return true;

  const secret = getCronSecret();
  // If no secret configured, leave the route open (dev convenience)
  if (!secret) return true;

  // Primary path for Netlify Scheduled Function
  const header = req.headers.get("x-cron-secret");
  if (header && header === secret) return true;

  // Manual fallback via query param
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Small grace to avoid races/clock skew (e.g., webhook arrives slightly late)
  const now = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

  // Atomic bulk cancel of expired holds
  const result = await db.booking.updateMany({
    where: {
      status: BookingStatus.PENDING,
      holdExpiresAt: { not: null, lt: now },
    },
    data: {
      status: BookingStatus.CANCELLED,
      holdExpiresAt: null,
    },
  });

  return Response.json(
    {
      ok: true,
      cancelled: result.count,
      asOfUtc: new Date().toISOString(),
    },
    {
      // Extra safety to avoid any edge caching
      headers: { "Cache-Control": "no-store" },
    }
  );
}
