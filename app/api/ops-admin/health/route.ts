// app/api/ops-admin/health/route.ts
import { NextResponse } from "next/server";
import {
  isOpsDashboardEnabled,
  isAuthDisabled,
  verifySessionFromCookie,
} from "@/lib/auth/session";

/**
 * GET /api/ops-admin/health
 * - 200 when feature flag is ON and either:
 *    • auth is disabled, or
 *    • session is valid, or
 *    • E2E bypass header matches.
 * - 401 when flag ON but unauthenticated (and auth enabled).
 * - 404 when feature flag OFF.
 * Always adds X-Robots-Tag and no-store caching.
 */
export async function GET(req: Request) {
  const withHeaders = (res: NextResponse) => {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  // Feature flag must be ON (no bypass of flag)
  if (!isOpsDashboardEnabled()) {
    return withHeaders(
      NextResponse.json({ ok: false, reason: "ops-disabled" }, { status: 404 })
    );
  }

  // E2E bypass (kept for CI & curl diagnostics)
  const e2eHeader = req.headers.get("x-e2e-secret");
  const e2eSecret = process.env.E2E_SECRET ?? "";
  if (e2eHeader && e2eSecret && e2eHeader === e2eSecret) {
    return withHeaders(
      NextResponse.json({ ok: true, role: "bypass", now: new Date().toISOString() })
    );
  }

  // NEW: mirror middleware — if auth is disabled, allow through
  if (isAuthDisabled()) {
    return withHeaders(
      NextResponse.json({ ok: true, role: "dev-open", now: new Date().toISOString() })
    );
  }

  // Normal auth path
  const cookieHeader = req.headers.get("cookie");
  const secret = process.env.AUTH_COOKIE_SECRET ?? "";
  const ver = await verifySessionFromCookie(cookieHeader, secret);

  if (!ver.ok) {
    return withHeaders(
      NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })
    );
  }

  return withHeaders(
    NextResponse.json({ ok: true, role: ver.session.role, now: new Date().toISOString() })
  );
}
