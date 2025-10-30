import { NextResponse, NextRequest } from "next/server";
import {
  verifySessionFromCookie,
  isAuthDisabled,
  isOpsDashboardEnabled,
} from "@/lib/auth/session";

const E2E_HEADER = "x-e2e-secret";
const E2E_SECRET = process.env.E2E_SECRET ?? "";
const AUTH_COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET ?? "";

// Hosts that should enforce canonical ops host.
// Staging/preview hosts like staging--algarvemachinery.netlify.app are NOT in this list.
const PROD_HOSTS = new Set([
  "algarvemachinery.netlify.app",
  "www.amr-rentals.com",
  "amr-rentals.com",
]);

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
  const reqHost = req.nextUrl.host;

  // 1. Canonicalize ops surfaces ONLY on prod-like hosts.
  //    - Prevents staging/branch deploys from being bounced to amr-rentals.com.
  //    - Still keeps prod traffic consolidated under amr-rentals.com.
  const isProdLikeHost = PROD_HOSTS.has(reqHost);
  const isOpsSurface =
    pathname === "/ops-admin" ||
    pathname.startsWith("/ops-admin/") ||
    pathname === "/api/ops-admin" ||
    pathname.startsWith("/api/ops-admin/");

  if (isProdLikeHost && isOpsSurface && reqHost !== "amr-rentals.com") {
    const url = new URL(req.url);
    url.protocol = "https:"; // enforce https
    url.hostname = "amr-rentals.com"; // single canonical ops host
    url.port = ""; // clean host
    return NextResponse.redirect(url, 308); // permanent canonicalization
  }

  // 2. Dev guard (prod-only surfaces)
  //    For /dev and /api/dev endpoints, require the E2E header UNLESS you're in a non-prod-like host.
  if (
    isProdLikeHost &&
    (isDevPath(pathname) || isDevApiPath(pathname))
  ) {
    if (req.headers.get(E2E_HEADER) !== E2E_SECRET) {
      return notFound("dev:prod:no-e2e");
    }
    return withNoIndex(NextResponse.next(), "dev:prod:e2e-ok");
  }

  // 3. If this is NOT /ops-admin or /api/ops-admin, just continue.
  if (!(isOpsPath(pathname) || isOpsApiPath(pathname))) {
    return NextResponse.next();
  }

  // 4. Feature flag check.
  if (!isOpsDashboardEnabled()) {
    return notFound("ops:flag-off");
  }

  // 5. E2E bypass still wins regardless of environment.
  if (req.headers.get(E2E_HEADER) === E2E_SECRET) {
    return withNoIndex(NextResponse.next(), "ops:bypass");
  }

  // 6. If auth is globally disabled (like deploy-preview), allow.
  if (isAuthDisabled()) {
    return withNoIndex(NextResponse.next(), "ops:auth-disabled");
  }

  // 7. Require cookie secret to even attempt auth.
  if (!AUTH_COOKIE_SECRET) {
    return unauthorized("ops:no-cookie-secret");
  }

  // 8. Verify session. If valid, pass through with role debug.
  const cookieHeader = req.headers.get("cookie");
  const ver = await verifySessionFromCookie(cookieHeader, AUTH_COOKIE_SECRET);

  if (ver.ok) {
    return withNoIndex(NextResponse.next(), `ops:auth-ok:${ver.session.role}`);
  }

  // 9. Not authenticated.
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
