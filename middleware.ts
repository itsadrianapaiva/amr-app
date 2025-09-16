import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Central guard for dev-only endpoints in production environments.
 * - Applies to /dev/* and /api/dev/*.
 * - Allows all traffic in non-production (local dev/CI).
 * - In production, requires header x-e2e-secret === process.env.E2E_SECRET.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Fast path: only guard dev routes
  if (
    pathname.startsWith("/dev/") === false &&
    pathname.startsWith("/api/dev/") === false
  ) {
    return NextResponse.next();
  }

  // Local/CI: open dev endpoints
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  // Production (staging/prod): require secret header
  const expected = process.env.E2E_SECRET;
  const provided = req.headers.get("x-e2e-secret");

  // If no secret configured, lock down by default
  if (!expected || provided !== expected) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

// Limit the middleware to dev-only paths
export const config = {
  matcher: ["/dev/:path*", "/api/dev/:path*"],
};
