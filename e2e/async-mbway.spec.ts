import { test, expect, APIRequestContext } from "@playwright/test";
import Stripe from "stripe";

const BASE_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string | undefined;
test.skip(!SIGNING_SECRET, "Missing STRIPE_WEBHOOK_SECRET env for webhook signing.");

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Create a PENDING booking far in the future; retry on overlap by shifting window.
 */
async function createBookingWithRetry(request: APIRequestContext) {
  const base = new Date();
  const jitter = Date.now() % 30;
  const machineId = 1; // non-heavy -> avoids lead-time rule

  for (let attempt = 0; attempt < 5; attempt++) {
    const start = new Date(base);
    start.setUTCDate(start.getUTCDate() + 36500 + jitter + attempt * 10); // year 2099+
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 2);

    const startDate = isoDay(start);
    const endDate = isoDay(end);

    const res = await request.post(`${BASE_URL}/api/dev/create-booking`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({
        machineId,
        startDate,
        endDate,
        name: "MBWAY User",
        email: "mbway@example.com",
        phone: "+351000000000",
        totalEuros: 200.0,
      }),
    });

    const status = res.status();
    const text = await res.text();

    if (res.ok()) {
      const json = JSON.parse(text);
      return { bookingId: json.bookingId as number, startDate, endDate, machineId };
    }
    if (status === 400 && text.includes("Selected dates are no longer available")) {
      continue;
    }
    throw new Error(`create-booking failed: HTTP ${status} — ${text}`);
  }
  throw new Error("create-booking failed after retries due to overlapping dates.");
}

test.describe("MB WAY async — processing -> webhook flip -> confirmed", () => {
  test("stays PENDING after session.completed (unpaid), then CONFIRMED after async_payment_succeeded", async ({ request }) => {
    // 1) Seed booking
    const { bookingId, startDate, endDate, machineId } = await createBookingWithRetry(request);

    // 2) Fire checkout.session.completed with UNPAID (async flow)
    const sessionId = `cs_test_${Date.now()}`;
    const piId = `pi_test_${Date.now()}`;
    const completedPayload = JSON.stringify({
      id: `evt_test_${Date.now()}`,
      object: "event",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          mode: "payment",
          status: "complete",            // session completed, but...
          payment_status: "unpaid",      // ...payment not yet confirmed
          client_reference_id: String(bookingId),
          metadata: {
            bookingId: String(bookingId),
            machineId: String(machineId),
            startDate,
            endDate,
            flow: "full_upfront",
            method_hint: "mb_way",
          },
          // No succeeded PI yet for async paths
          payment_intent: { id: piId, object: "payment_intent", status: "processing" },
          amount_total: 20000,
        },
      },
    });
    const sigCompleted = Stripe.webhooks.generateTestHeaderString({
      payload: completedPayload,
      secret: SIGNING_SECRET!,
    });
    const resCompleted = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: { "stripe-signature": sigCompleted, "content-type": "application/json" },
      data: completedPayload,
    });
    expect(resCompleted.ok()).toBeTruthy();

    // 3) Assert still PENDING (not promoted yet)
    {
      const r = await request.get(`${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`, {
        headers: { "cache-control": "no-store" },
      });
      expect(r.ok()).toBeTruthy();
      const js = await r.json();
      expect(js.status).toBe("PENDING");
      expect(js.depositPaid).toBe(false);
    }

    // 4) Fire checkout.session.async_payment_succeeded (MB WAY confirmation)
    const asyncSucceededPayload = JSON.stringify({
      id: `evt_test_${Date.now()}_s2`,
      object: "event",
      type: "checkout.session.async_payment_succeeded",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          mode: "payment",
          status: "complete",
          payment_status: "paid",
          client_reference_id: String(bookingId),
          metadata: {
            bookingId: String(bookingId),
            machineId: String(machineId),
            startDate,
            endDate,
            flow: "full_upfront",
            method_hint: "mb_way",
          },
          payment_intent: { id: piId, object: "payment_intent", status: "succeeded" },
          amount_total: 20000,
        },
      },
    });
    const sigAsync = Stripe.webhooks.generateTestHeaderString({
      payload: asyncSucceededPayload,
      secret: SIGNING_SECRET!,
    });
    const resAsync = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: { "stripe-signature": sigAsync, "content-type": "application/json" },
      data: asyncSucceededPayload,
    });
    expect(resAsync.ok()).toBeTruthy();

    // 5) Poll until CONFIRMED & hold cleared
    let status = "PENDING";
    let depositPaid = false;
    let stripePaymentIntentId: string | null = null;
    let holdExpiresAt: string | null = "non-null";

    for (let i = 0; i < 12; i++) {
      const inspectRes = await request.get(
        `${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`,
        { headers: { "cache-control": "no-store" } }
      );
      const body = await inspectRes.text();
      expect(inspectRes.ok(), `inspect failed: ${inspectRes.status()} — ${body}`).toBeTruthy();
      const json = JSON.parse(body);
      status = json?.status ?? status;
      depositPaid = json?.depositPaid ?? depositPaid;
      stripePaymentIntentId = json?.stripePaymentIntentId ?? stripePaymentIntentId;
      holdExpiresAt = Object.prototype.hasOwnProperty.call(json, "holdExpiresAt")
        ? json.holdExpiresAt
        : holdExpiresAt;

      if (status === "CONFIRMED" && depositPaid && stripePaymentIntentId) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    expect(status).toBe("CONFIRMED");
    expect(depositPaid).toBe(true);
    expect(stripePaymentIntentId).toBeTruthy();
    expect(holdExpiresAt).toBeNull();

    // 6) Idempotency check: send async success again -> no error, still confirmed
    const resAsyncAgain = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: { "stripe-signature": sigAsync, "content-type": "application/json" },
      data: asyncSucceededPayload,
    });
    expect(resAsyncAgain.ok()).toBeTruthy();

    const final = await (await request.get(`${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`)).json();
    expect(final.status).toBe("CONFIRMED");
    expect(final.depositPaid).toBe(true);
  });
});
