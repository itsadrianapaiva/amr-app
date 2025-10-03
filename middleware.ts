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

/** Attach noindex headers for ops-admin surfaces. */
function withNoIndex(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
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
function notFound(): NextResponse {
  return new NextResponse("Not Found", { status: 404 });
}

/** 401 helper */
function unauthorized(): NextResponse {
  return new NextResponse("Unauthorized", { status: 401 });
}
// JSON 401 for APIs so curl never sees HTML
function unauthorizedJson(): NextResponse {
  return NextResponse.json(
    { ok: false, reason: "unauthorized" },
    { status: 401 }
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, origin, search } = req.nextUrl;

  // ----- Dev guard (unchanged): protect /dev and /api/dev in production via secret header
  if (
    process.env.NODE_ENV === "production" &&
    (isDevPath(pathname) || isDevApiPath(pathname))
  ) {
    if (req.headers.get(E2E_HEADER) !== E2E_SECRET) {
      return notFound();
    }
    return NextResponse.next();
  }

  // ----- Ops-admin guard only for /ops-admin and /api/ops-admin/*
  if (!(isOpsPath(pathname) || isOpsApiPath(pathname))) {
    // Not an ops-admin path → passthrough
    return NextResponse.next();
  }

  // Always send noindex on any ops-admin path (pages and API)
  // Even when returning errors/redirects we’ll attach it below.
  const attachNoIndex = (res: NextResponse) => withNoIndex(res);

  // If feature flag off → 404
  if (!isOpsDashboardEnabled()) {
    return attachNoIndex(notFound());
  }

  // e2e bypass supported everywhere (useful for CI legs)
  if (req.headers.get(E2E_HEADER) === E2E_SECRET) {
    return attachNoIndex(NextResponse.next());
  }

  // If auth is disabled by flag → allow
  if (isAuthDisabled()) {
    return attachNoIndex(NextResponse.next());
  }

  // At this point: feature ON and auth required → verify cookie
  if (!AUTH_COOKIE_SECRET) {
    // Misconfiguration safety net: if missing secret, block rather than silently allow
    return attachNoIndex(unauthorized());
  }

  const cookieHeader = req.headers.get("cookie");
  const ver = await verifySessionFromCookie(cookieHeader, AUTH_COOKIE_SECRET);

  if (ver.ok) {
    return attachNoIndex(NextResponse.next());
  }

  // Not authenticated:
  if (isApiPath(pathname)) {
    // API under /api/ops-admin → 401 JSON-ish plain text
    return withNoIndex(unauthorizedJson());
  } else {
    // Page under /ops-admin → redirect to /login?next=…
    const nextParam = encodeURIComponent(pathname + (search ?? ""));
    const url = new URL(`/login?next=${nextParam}`, origin);
    return withNoIndex(NextResponse.redirect(url));
  }
}

// Limit middleware to only the routes we actually need.
// This reduces overhead on unrelated pages and avoids surprise interactions.
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
