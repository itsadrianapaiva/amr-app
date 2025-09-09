import { test, expect, APIRequestContext } from "@playwright/test";
import Stripe from "stripe";

const BASE_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string | undefined;
test.skip(
  !SIGNING_SECRET,
  "Missing STRIPE_WEBHOOK_SECRET env for webhook signing."
);

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Create a PENDING booking with automatic conflict avoidance:
 * - Start far in the future (≥180 days), add deterministic jitter,
 * - Retry on "Selected dates are no longer available." by shifting window +10 days.
 */
async function createBookingWithRetry(request: APIRequestContext) {
  const base = new Date();
  const jitter = Date.now() % 30; // deterministic per run
  const machineId = 1; // non-heavy, avoids lead-time rule

  for (let attempt = 0; attempt < 5; attempt++) {
    const start = new Date(base);
    start.setUTCDate(start.getUTCDate() + 180 + jitter + attempt * 10);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 2); // 3-day inclusive rental

    const startDate = isoDay(start);
    const endDate = isoDay(end);

    const res = await request.post(`${BASE_URL}/api/dev/create-booking`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({
        machineId,
        startDate,
        endDate,
        name: "E2E User",
        email: "e2e@example.com",
        phone: "+351000000000",
        totalEuros: 123.45,
      }),
    });

    const status = res.status();
    const text = await res.text();

    if (res.ok()) {
      const json = JSON.parse(text);
      return {
        bookingId: json.bookingId as number,
        startDate,
        endDate,
        machineId,
      };
    }

    // Retry on known overlap message; otherwise fail fast with details
    if (
      status === 400 &&
      text.includes("Selected dates are no longer available")
    ) {
      continue; // shift window and try again
    }
    throw new Error(`create-booking failed: HTTP ${status} — ${text}`);
  }

  throw new Error(
    "create-booking failed after retries due to overlapping dates."
  );
}

test.describe("Card happy path — booking promotion via webhook", () => {
  test("PENDING -> CONFIRMED after checkout.session.completed", async ({
    request,
  }) => {
    // -- 1) Create a minimal PENDING booking with robust overlap handling
    const { bookingId, startDate, endDate, machineId } =
      await createBookingWithRetry(request);

    // -- 2) Build a Stripe checkout.session.completed event payload
    const sessionId = `cs_test_${Date.now()}`;
    const piId = `pi_test_${Date.now()}`;
    const payloadObj = {
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
          status: "complete",
          payment_status: "paid",
          client_reference_id: String(bookingId),
          metadata: {
            bookingId: String(bookingId),
            machineId: String(machineId),
            startDate,
            endDate,
            flow: "full_upfront",
          },
          payment_intent: {
            id: piId,
            object: "payment_intent",
            status: "succeeded",
          },
          amount_total: 12345,
        },
      },
    };
    const payload = JSON.stringify(payloadObj);

    // -- 3) Generate a valid Stripe signature header for the raw JSON payload
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: SIGNING_SECRET!,
    });

    // -- 4) POST to our webhook with the signed payload (raw body)
    const hookRes = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: {
        "stripe-signature": signature,
        "content-type": "application/json",
      },
      data: payload,
    });
    const hookStatus = hookRes.status();
    const hookText = await hookRes.text();
    expect(
      hookRes.ok(),
      `webhook failed: HTTP ${hookStatus} — ${hookText}`
    ).toBeTruthy();

    // -- 5) Poll the dev inspect endpoint until the booking is CONFIRMED
    let status = "PENDING";
    let depositPaid = false;
    let stripePaymentIntentId: string | null = null;
    let holdExpiresAt: string | null = "non-null";

    for (let i = 0; i < 10; i++) {
      const inspectRes = await request.get(
        `${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`,
        { headers: { "cache-control": "no-store" } }
      );
      const inspectStatus = inspectRes.status();
      const inspectBodyText = await inspectRes.text();
      expect(
        inspectRes.ok(),
        `inspect-booking failed: HTTP ${inspectStatus} — ${inspectBodyText}`
      ).toBeTruthy();

      const json = JSON.parse(inspectBodyText);
      status = json?.status ?? status;
      depositPaid = json?.depositPaid ?? depositPaid;
      stripePaymentIntentId =
        json?.stripePaymentIntentId ?? stripePaymentIntentId;

      //if the property exists (even if null), accept it; otherwise keep prior
      holdExpiresAt = Object.prototype.hasOwnProperty.call(
        json,
        "holdExpiresAt"
      )
        ? json.holdExpiresAt
        : holdExpiresAt;

      if (status === "CONFIRMED" && depositPaid && stripePaymentIntentId) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    // -- 6) Assert final state
    expect(status).toBe("CONFIRMED");
    expect(depositPaid).toBe(true);
    expect(stripePaymentIntentId).toBeTruthy();
    expect(holdExpiresAt).toBeNull();
  });
});
