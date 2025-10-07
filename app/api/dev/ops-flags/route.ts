// app/api/dev/ops-flags/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // Read all variants to catch naming drift between code paths
  const enabled = process.env.OPS_DASHBOARD_ENABLED ?? "";
  const disableAuthA = process.env.OPS_DISABLE_AUTH ?? "";
  const disableAuthB = process.env.OPS_AUTH_DISABLED ?? "";

  // Minimal payload; do not leak secrets (only presence/length for cookie secret)
  const hasCookieSecret = typeof process.env.AUTH_COOKIE_SECRET === "string" && process.env.AUTH_COOKIE_SECRET.length >= 32;

  return NextResponse.json(
    {
      env: process.env.NODE_ENV,
      runtime: process.env.NEXT_RUNTIME ?? "node", // Next.js sets this on edge
      ops: {
        OPS_DASHBOARD_ENABLED: enabled,
        OPS_DISABLE_AUTH: disableAuthA,
        OPS_AUTH_DISABLED: disableAuthB,
      },
      auth: {
        AUTH_COOKIE_SECRET_present: hasCookieSecret,
      },
    },
    {
      // Helpful for black-box checks without exposing values
      headers: {
        "x-ops-enabled": String(enabled),
        "x-ops-disable-auth-a": String(disableAuthA),
        "x-ops-disable-auth-b": String(disableAuthB),
      },
    }
  );
}
