import { test, expect, APIRequestContext } from "@playwright/test";
import Stripe from "stripe";

const BASE_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:8888";

const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string | undefined;
test.skip(
  !SIGNING_SECRET,
  "Missing STRIPE_WEBHOOK_SECRET env for webhook signing."
);

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Robust creator: POST + retries, mirrors other specs
async function createBookingWithRetry(request: APIRequestContext) {
  const base = new Date();
  const jitter = Date.now() % 30;
  const machineId = 1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const start = new Date(base);
    start.setUTCDate(start.getUTCDate() + 180 + jitter + attempt * 10);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 2);

    const res = await request.post(`${BASE_URL}/api/dev/create-booking`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({
        machineId,
        startDate: isoDay(start),
        endDate: isoDay(end),
        name: "E2E Card Happy Idem",
        email: "e2e-card-idem@example.com",
        phone: "+351000000000",
        totalEuros: 123.45,
      }),
    });

    if (res.ok()) {
      const json = await res.json();
      return { bookingId: json.bookingId as number, machineId, start, end };
    }

    const status = res.status();
    const text = await res.text();
    if (status === 400 && text.includes("Selected dates are no longer available")) continue;
    throw new Error(`create-booking failed: HTTP ${status} — ${text}`);
  }

  throw new Error("create-booking failed after retries due to overlapping dates.");
}

test.describe("Card paid path — idempotency", () => {
  test("replaying checkout.session.completed does not double-promote", async ({ request }) => {
    // 1) Arrange: create a fresh PENDING booking
    const { bookingId, machineId, start, end } = await createBookingWithRetry(request);
    const startDate = isoDay(start);
    const endDate = isoDay(end);

    const sessionId = `cs_test_${Date.now()}`;
    const piId = `pi_test_${Date.now()}`;

    // 2) Build the 'paid' completed event (promotes to CONFIRMED)
    const completedPayload = JSON.stringify({
      id: `evt_test_completed_${Date.now()}`,
      object: "event",
      type: "checkout.session.completed",
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
            pm_type: "card",
          },
          payment_intent: { id: piId, object: "payment_intent", status: "succeeded" },
          amount_total: 12345,
        },
      },
    });
    const sig1 = Stripe.webhooks.generateTestHeaderString({
      payload: completedPayload,
      secret: SIGNING_SECRET!,
    });

    // 3) First delivery — should promote to CONFIRMED
    const hook1 = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: { "stripe-signature": sig1, "content-type": "application/json" },
      data: completedPayload,
    });
    expect(hook1.ok(), `webhook(1) failed: ${await hook1.text()}`).toBeTruthy();

    // Poll for CONFIRMED
    let status = "PENDING";
    let depositPaid = false;
    let stripePaymentIntentId: string | null = null;
    for (let i = 0; i < 10; i++) {
      const res = await request.get(`${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`, {
        headers: { "cache-control": "no-store" },
      });
      expect(res.ok()).toBeTruthy();
      const json = await res.json();
      status = json?.status ?? status;
      depositPaid = json?.depositPaid ?? depositPaid;
      stripePaymentIntentId = json?.stripePaymentIntentId ?? stripePaymentIntentId;
      if (status === "CONFIRMED" && depositPaid && stripePaymentIntentId) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(status).toBe("CONFIRMED");
    expect(depositPaid).toBe(true);
    expect(stripePaymentIntentId).toBe(piId);

    // 4) Replay EXACT SAME event body — must be idempotent
    const sig2 = Stripe.webhooks.generateTestHeaderString({
      payload: completedPayload,
      secret: SIGNING_SECRET!,
    });
    const hook2 = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: { "stripe-signature": sig2, "content-type": "application/json" },
      data: completedPayload,
    });
    expect(hook2.ok(), `webhook(2) failed: ${await hook2.text()}`).toBeTruthy();

    // 5) Assert still CONFIRMED and PI unchanged
    const final = await request.get(`${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`, {
      headers: { "cache-control": "no-store" },
    });
    expect(final.ok()).toBeTruthy();
    const json = await final.json();
    expect(json?.status).toBe("CONFIRMED");
    expect(json?.stripePaymentIntentId).toBe(piId);
    expect(json?.holdExpiresAt).toBeNull();
  });
});
