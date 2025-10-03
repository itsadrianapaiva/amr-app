import { NextResponse } from "next/server";
import {
  isOpsDashboardEnabled,
  verifySessionFromCookie,
} from "@/lib/auth/session";

/**
 * GET /api/ops-admin/health
 * - 200 when feature flag is ON and the ops session is valid.
 * - 401 when flag ON but unauthenticated.
 * - 404 when feature flag OFF.
 * Always adds X-Robots-Tag and no-store caching.
 */
export async function GET(req: Request) {
  // Always noindex/no-store for ops endpoints
  const withHeaders = (res: NextResponse) => {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  if (!isOpsDashboardEnabled()) {
    return withHeaders(
      NextResponse.json({ ok: false, reason: "ops-disabled" }, { status: 404 })
    );
  }

  const cookieHeader = req.headers.get("cookie");
  const secret = process.env.AUTH_COOKIE_SECRET ?? "";
  const ver = await verifySessionFromCookie(cookieHeader, secret);

  if (!ver.ok) {
    return withHeaders(
      NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })
    );
  }

  // Minimal payload; add more fields later if useful
  return withHeaders(
    NextResponse.json({
      ok: true,
      role: ver.session.role,
      now: new Date().toISOString(),
    })
  );
}
