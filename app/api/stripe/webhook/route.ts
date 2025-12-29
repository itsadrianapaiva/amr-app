// Skinny Stripe webhook route: verifies signature, delegates to handler.

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe/webhook-handlers";
import type { LogFn } from "@/lib/stripe/webhook-service";
import { db } from "@/lib/db";

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

  // 3) Idempotency gate: ensure each event.id is processed at most once
  try {
    await db.stripeEvent.create({
      data: { eventId: event.id, type: event.type, bookingId: null },
    });
  } catch (err: any) {
    // Unique constraint violation = duplicate delivery
    if (err && err.code === "P2002") {
      log("duplicate_event", { id: event.id, type: event.type });
      return new Response("ok", { status: 200 });
    }
    // Other DB errors: log & ACK to avoid retry storms
    log("idempotency_record_error", {
      id: event.id,
      type: event.type,
      err: err instanceof Error ? err.message : String(err),
    });
    return new Response("ok", { status: 200 });
  }

  // 4) Delegate to centralized handler (flow-aware logic lives outside the route)
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

  // 4.1) Immediate non-blocking kick to process jobs (A3.5)
  //      Best-effort: failure does not affect webhook ACK
  //      Cron fallback ensures jobs are processed even if kick fails
  kickJobProcessor(log);

  // 5) Always ACK handled/ignored events
  return new Response("ok", { status: 200 });
}

/**
 * Kick job processor immediately (non-blocking, best-effort).
 * Uses internal route with cron auth.
 */
function kickJobProcessor(log: LogFn): void {
  // Fire and forget - do not await
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    if (dbg()) log("kick:no_app_url");
    return;
  }

  const secret = process.env.CRON_SECRET;
  const endpoint = secret
    ? `${appUrl}/api/cron/process-booking-jobs?token=${encodeURIComponent(secret)}`
    : `${appUrl}/api/cron/process-booking-jobs`;

  const headers: Record<string, string> = {};
  if (secret) headers["x-cron-secret"] = secret;

  // Non-blocking fetch with short timeout
  fetch(endpoint, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(2000), // 2s timeout
  })
    .then((res) => {
      if (dbg()) {
        log("kick:done", { status: res.status, ok: res.ok });
      }
    })
    .catch((err) => {
      // Ignore errors - cron fallback will process jobs
      if (dbg()) {
        log("kick:error", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    });
}
