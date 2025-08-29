// Node runtime (Prisma) + no caching
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

/**
 * Simple safety: if CRON_SECRET is set, require ?token=CRON_SECRET.
 * This secure the endpoint without extra infra.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unsecured if no secret configured
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Small grace to avoid races/clock skew (e.g., webhook arriving slightly late)
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

  return Response.json({
    ok: true,
    cancelled: result.count,
    asOfUtc: new Date().toISOString(),
  });
}
