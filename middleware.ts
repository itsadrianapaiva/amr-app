import { NextResponse, NextRequest } from "next/server";
import {
  verifySessionFromCookie,
  isAuthDisabled,
  isOpsDashboardEnabled,
} from "@/lib/auth/session";

const E2E_HEADER = "x-e2e-secret";
const E2E_SECRET = process.env.E2E_SECRET ?? "";
const AUTH_COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET ?? "";

// Paths we care about
const OPS_PREFIX = "/ops-admin";
const OPS_API_PREFIX = "/api/ops-admin";
const DEV_PREFIX = "/dev";
const DEV_API_PREFIX = "/api/dev";

/** Attach noindex headers for ops-admin surfaces + optional debug. */
function withNoIndex(res: NextResponse, dbg?: string): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (dbg) res.headers.set("X-Auth-Debug", dbg);
  return res;
}

/** Quick helpers */
const isApiPath = (p: string) => p.startsWith("/api");
const isOpsPath = (p: string) =>
  p === OPS_PREFIX || p.startsWith(OPS_PREFIX + "/");
const isOpsApiPath = (p: string) =>
  p === OPS_API_PREFIX || p.startsWith(OPS_API_PREFIX + "/");
const isDevPath = (p: string) =>
  p === DEV_PREFIX || p.startsWith(DEV_PREFIX + "/");
const isDevApiPath = (p: string) =>
  p === DEV_API_PREFIX || p.startsWith(DEV_API_PREFIX + "/");

/** 404 helper */
function notFound(dbg?: string): NextResponse {
  return withNoIndex(new NextResponse("Not Found", { status: 404 }), dbg);
}
/** 401 helpers */
function unauthorized(dbg?: string): NextResponse {
  return withNoIndex(new NextResponse("Unauthorized", { status: 401 }), dbg);
}
function unauthorizedJson(dbg?: string): NextResponse {
  return withNoIndex(
    NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 }),
    dbg
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, origin, search } = req.nextUrl;

  // Canonicalize host early for ops surfaces in production ---
  if (process.env.NODE_ENV === "production") {
    const primaryHost = "amr-rentals.com"; // single source of truth
    const reqHost = req.nextUrl.host; // hostname[:port]
    const isOpsSurface =
      pathname === "/ops-admin" ||
      pathname.startsWith("/ops-admin/") ||
      pathname === "/api/ops-admin" ||
      pathname.startsWith("/api/ops-admin/");

    if (isOpsSurface && reqHost !== primaryHost) {
      const url = new URL(req.url);
      url.protocol = "https:"; // enforce https
      url.hostname = primaryHost; // drop deploy-hash / www hosts
      url.port = ""; // ensure clean host
      return NextResponse.redirect(url, 308); // permanent canonicalization
    }
  }

  // Dev guard (prod only)
  if (
    process.env.NODE_ENV === "production" &&
    (isDevPath(pathname) || isDevApiPath(pathname))
  ) {
    if (req.headers.get(E2E_HEADER) !== E2E_SECRET) {
      return notFound("dev:prod:no-e2e");
    }
    return withNoIndex(NextResponse.next(), "dev:prod:e2e-ok");
  }

  // Only guard ops-admin surfaces
  if (!(isOpsPath(pathname) || isOpsApiPath(pathname))) {
    return NextResponse.next();
  }

  // Feature flag
  if (!isOpsDashboardEnabled()) {
    return notFound("ops:flag-off");
  }

  // E2E bypass
  if (req.headers.get(E2E_HEADER) === E2E_SECRET) {
    return withNoIndex(NextResponse.next(), "ops:bypass");
  }

  // Auth disabled?
  if (isAuthDisabled()) {
    return withNoIndex(NextResponse.next(), "ops:auth-disabled");
  }

  // Require secret configured
  if (!AUTH_COOKIE_SECRET) {
    return unauthorized("ops:no-cookie-secret");
  }

  // Verify session
  const cookieHeader = req.headers.get("cookie");
  const ver = await verifySessionFromCookie(cookieHeader, AUTH_COOKIE_SECRET);

  if (ver.ok) {
    return withNoIndex(NextResponse.next(), `ops:auth-ok:${ver.session.role}`);
  }

  // Not authenticated
  if (isApiPath(pathname)) {
    return unauthorizedJson("ops:api:auth-miss");
  } else {
    const nextParam = encodeURIComponent(pathname + (search ?? ""));
    const url = new URL(`/login?next=${nextParam}`, origin);
    return withNoIndex(NextResponse.redirect(url), "ops:page:redirect-login");
  }
}

export const config = {
  matcher: [
    "/ops-admin",
    "/ops-admin/:path*",
    "/api/ops-admin/:path*",
    "/dev",
    "/dev/:path*",
    "/api/dev/:path*",
  ],
};
