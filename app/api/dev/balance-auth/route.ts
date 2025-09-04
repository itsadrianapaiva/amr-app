// Dev-only endpoint to create a BALANCE AUTHORIZATION Checkout session for a booking.
// Guarded by OPS_PASSCODE. No extra exports besides runtime/dynamic/GET.

import { NextRequest } from "next/server";
import { createBalanceAuthorization } from "@/app/actions/create-balance-authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export async function GET(req: NextRequest) {
  try {
    const passcode = requireEnv("OPS_PASSCODE");

    const url = new URL(req.url);
    const q = url.searchParams;

    // Guard
    const provided = q.get("passcode") || "";
    if (provided !== passcode) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // booking_id parsing
    const bookingIdStr = q.get("booking_id") || "";
    const bookingId = Number(bookingIdStr);
    if (!Number.isFinite(bookingId)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid booking_id" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Create the manual-capture Checkout Session
    const res = await createBalanceAuthorization(bookingId);
    if (!res.ok) {
      return new Response(JSON.stringify(res), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Optional redirect to Stripe
    const shouldRedirect = q.get("redirect") === "1";
    if (shouldRedirect) {
      return Response.redirect(res.url, 302);
    }

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[dev] balance-auth route error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
