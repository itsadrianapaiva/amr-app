// Skinny Stripe webhook route: verifies signature, delegates to handler.

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe/webhook-handlers";
import type { LogFn } from "@/lib/stripe/webhook-service";

// Stripe requires the Node runtime & raw body
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Small structured logger shared with handler/service
const log: LogFn = (event, data) =>
  console.log("[stripe:webhook]", event, data ?? {});

/** Env guard */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

/** Debug toggle (staging-only) */
function dbg() {
  return process.env["LOG_WEBHOOK_DEBUG"] === "1";
}

export async function POST(req: NextRequest) {
  // Basic request metadata (no payload, no secrets)
  if (dbg()) {
    log("req_meta", {
      ct: req.headers.get("content-type"),
      len: req.headers.get("content-length"),
      hasSig: !!req.headers.get("stripe-signature"),
      nfReqId: req.headers.get("x-nf-request-id"),
    });
  }

  // 1) Read RAW body for signature verification
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  if (!sig) {
    log("missing_signature");
    return new Response("Missing Stripe signature", { status: 400 });
  }

  // 2) Verify signature -> Stripe.Event
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    log("signature_verify_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    // Reject so Stripe retries (only on verify failures)
    return new Response("Signature verification failed", { status: 400 });
  }

  log("received", { type: event.type, id: event.id, livemode: event.livemode });

  // 3) Delegate to centralized handler (flow-aware logic lives outside the route)
  try {
    await handleStripeEvent(event, log);
  } catch (err) {
    // Avoid endless retries for our own handler bugs; log & ACK
    log("handler_error", {
      err: err instanceof Error ? err.message : String(err),
      type: event.type,
    });
    return new Response("ok", { status: 200 });
  }

  // 4) Always ACK handled/ignored events
  return new Response("ok", { status: 200 });
}
