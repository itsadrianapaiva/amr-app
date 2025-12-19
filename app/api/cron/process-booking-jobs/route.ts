// Node runtime (Prisma) + no caching
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { processBookingJobs } from "@/lib/jobs/process-booking-jobs";

/**
 * Auth matrix (same pattern as expire-holds):
 * - Netlify Scheduled Function: send header "x-cron-secret: <CRON_SECRET>"
 * - Vercel Cron: header "x-vercel-cron: 1" (kept for portability)
 * - Manual fallback: query string ?token=<CRON_SECRET>
 */
function isAuthorized(req: NextRequest): boolean {
  // Accept Vercel's built-in cron header (if ever used)
  if (req.headers.get("x-vercel-cron") === "1") return true;

  const secret = process.env.CRON_SECRET;
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

  // Process up to 10 jobs per invocation
  const result = await processBookingJobs({ limit: 10 });

  return Response.json(
    {
      ok: true,
      processed: result.processed,
      remainingPending: result.remainingPending,
      asOfUtc: new Date().toISOString(),
    },
    {
      // Extra safety to avoid any edge caching
      headers: { "Cache-Control": "no-store" },
    }
  );
}
