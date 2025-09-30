// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  readSessionTokenFromCookieHeader,
  verifySessionToken,
} from "@/lib/auth/session";

/**
 * Central guards:
 * 1) Dev-only endpoints (/dev/*, /api/dev/*) → keep your existing e2e-secret protection.
 * 2) Internal Ops Admin (/ops-admin, /ops-admin/*, /api/ops-admin/*) → feature-flag + cookie session.
 *
 * Notes:
 * - Public manager self-bookings under /ops are NOT touched here.
 * - Always set X-Robots-Tag: noindex on /ops-admin responses.
 */

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ----------------------------
  // Guard (A): dev-only endpoints
  // ----------------------------
  if (pathname.startsWith("/dev/") || pathname.startsWith("/api/dev/")) {
    // Local/CI: open dev endpoints
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }
    // Production (staging/prod): require secret header
    const expected = process.env.E2E_SECRET;
    const provided = req.headers.get("x-e2e-secret");
    if (!expected || provided !== expected) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return NextResponse.next();
  }

  // Guard (B): internal dashboard (/ops-admin)

  const isOpsAdmin =
    pathname === "/ops-admin" ||
    pathname.startsWith("/ops-admin/") ||
    pathname.startsWith("/api/ops-admin/");

  if (!isOpsAdmin) {
    // Fast-path: for all other routes do nothing
    return NextResponse.next();
  }

  const addRobotsNoindex = (res: NextResponse) => {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  };

  // Feature flag: keep prod dark until explicitly enabled
  const enabled = process.env.OPS_DASHBOARD_ENABLED === "1";
  if (!enabled) {
    return addRobotsNoindex(new NextResponse("Not Found", { status: 404 }));
  }

  // Optional: allow CI smoke or scripted checks via x-e2e-secret (no auth)
  const e2eHeader = req.headers.get("x-e2e-secret");
  if (e2eHeader && e2eHeader === process.env.E2E_SECRET) {
    return addRobotsNoindex(NextResponse.next());
  }

  // When auth is disabled (staging-sim / previews), allow through
  const authDisabled = process.env.OPS_DISABLE_AUTH === "1";
  if (authDisabled) {
    return addRobotsNoindex(NextResponse.next());
  }

  // Auth wall: require a valid amr_ops cookie
  const cookieHeader = req.headers.get("cookie");
  const token = readSessionTokenFromCookieHeader(cookieHeader);
  const verified = token
    ? verifySessionToken(token)
    : { ok: false as const, error: "malformed" as const };

  if (verified.ok) {
    // Session is valid → allow
    return addRobotsNoindex(NextResponse.next());
  }

  // If it’s an API route, respond with 401 instead of redirect
  if (pathname.startsWith("/api/ops-admin/")) {
    return addRobotsNoindex(new NextResponse("Unauthorized", { status: 401 }));
  }

  // Otherwise redirect to login with return URL
  const next = encodeURIComponent(pathname);
  const url = new URL(`/login?next=${next}`, req.url);
  return addRobotsNoindex(NextResponse.redirect(url));
}

// Limit middleware to the exact paths we guard (keeps perf tight)
export const config = {
  matcher: [
    "/dev/:path*",
    "/api/dev/:path*",
    "/ops-admin",
    "/ops-admin/:path*",
    "/api/ops-admin/:path*",
  ],
};
