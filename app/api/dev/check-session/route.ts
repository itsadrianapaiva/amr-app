import "server-only";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dev route to check Stripe session metadata.
 * Usage: GET /api/dev/check-session?session_id=cs_test_...
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "Missing ?session_id parameter" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const result = {
      ok: true,
      session: {
        id: session.id,
        payment_intent: session.payment_intent,
        amount_total: session.amount_total,
        status: session.status,
        payment_status: session.payment_status,
      },
      metadata: session.metadata,
      discountMetadataFields: {
        discount_percent: session.metadata?.discount_percent || null,
        original_subtotal_cents: session.metadata?.original_subtotal_cents || null,
        discounted_subtotal_cents: session.metadata?.discounted_subtotal_cents || null,
      },
      analysis: {
        hasDiscountPercent: !!session.metadata?.discount_percent,
        hasOriginalCents: !!session.metadata?.original_subtotal_cents,
        hasDiscountedCents: !!session.metadata?.discounted_subtotal_cents,
        allThreePresent: !!(
          session.metadata?.discount_percent &&
          session.metadata?.original_subtotal_cents &&
          session.metadata?.discounted_subtotal_cents
        ),
      },
    };

    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[dev/check-session] Error:", msg);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
