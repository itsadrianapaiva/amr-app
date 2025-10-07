// app/api/dev/ops-flags/route.ts
export const dynamic = "force-dynamic";        // ensure runtime evaluation, no prerender
export const revalidate = 0;                   // opt out of ISR entirely
import { NextResponse } from "next/server";

export async function GET() {
  // Read both variants to catch naming drift between code paths
  const enabled = process.env.OPS_DASHBOARD_ENABLED ?? "";
  const disableAuthA = process.env.OPS_DISABLE_AUTH ?? "";
  const disableAuthB = process.env.OPS_AUTH_DISABLED ?? "";

  // Presence-only check (don’t leak secrets)
  const hasCookieSecret =
    typeof process.env.AUTH_COOKIE_SECRET === "string" &&
    process.env.AUTH_COOKIE_SECRET.length >= 32;

  const body = {
    env: process.env.NODE_ENV,
    runtime: process.env.NEXT_RUNTIME ?? "node",
    ops: {
      OPS_DASHBOARD_ENABLED: enabled,
      OPS_DISABLE_AUTH: disableAuthA,
      OPS_AUTH_DISABLED: disableAuthB,
    },
    auth: {
      AUTH_COOKIE_SECRET_present: hasCookieSecret,
    },
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-ops-enabled": String(enabled),
      "x-ops-disable-auth-a": String(disableAuthA),
      "x-ops-disable-auth-b": String(disableAuthB),
    },
  });
}
