import { test, expect, APIRequestContext } from "@playwright/test";
import Stripe from "stripe";

// Reuse your env pattern
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
 * Create a PENDING booking with overlap-avoidance, same approach as your happy path.
 * Kept local to avoid cross-file imports in tests.
 */
async function createBookingWithRetry(request: APIRequestContext) {
  const base = new Date();
  const jitter = Date.now() % 30;
  const machineId = 1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const start = new Date(base);
    start.setUTCDate(start.getUTCDate() + 180 + jitter + attempt * 10);
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
        name: "E2E User (3DS)",
        email: "e2e-3ds@example.com",
        phone: "+351000000000",
        totalEuros: 234.56,
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

    if (
      status === 400 &&
      text.includes("Selected dates are no longer available")
    ) {
      continue;
    }
    throw new Error(`create-booking failed: HTTP ${status} — ${text}`);
  }

  throw new Error(
    "create-booking failed after retries due to overlapping dates."
  );
}

test.describe("Card 3DS async path — promote only after async_payment_succeeded", () => {
  test("PENDING stays until async success, then CONFIRMED", async ({ request }) => {
    // -- 1) Create a PENDING booking
    const { bookingId, startDate, endDate, machineId } =
      await createBookingWithRetry(request);

    // We'll keep a stable PI across both events
    const sessionId = `cs_test_${Date.now()}`;
    const piId = `pi_test_${Date.now()}`;

    // -- 2) Send checkout.session.completed with unpaid/requires_action
    const completedPayloadObj = {
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
          // IMPORTANT: unpaid so our webhook defers promotion
          payment_status: "unpaid",
          client_reference_id: String(bookingId),
          metadata: {
            bookingId: String(bookingId),
            machineId: String(machineId),
            startDate,
            endDate,
            flow: "full_upfront",
            pm_type: "card_3ds",
          },
          // PI exists but needs action (SCA)
          payment_intent: {
            id: piId,
            object: "payment_intent",
            status: "requires_action",
          },
          amount_total: 23456,
        },
      },
    };
    const completedPayload = JSON.stringify(completedPayloadObj);
    const completedSig = Stripe.webhooks.generateTestHeaderString({
      payload: completedPayload,
      secret: SIGNING_SECRET!,
    });

    const completedRes = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: {
        "stripe-signature": completedSig,
        "content-type": "application/json",
      },
      data: completedPayload,
    });
    expect(
      completedRes.ok(),
      `completed webhook failed: ${await completedRes.text()}`
    ).toBeTruthy();

    // -- 3) Verify NOT promoted yet
    {
      const inspectRes = await request.get(
        `${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`,
        { headers: { "cache-control": "no-store" } }
      );
      expect(inspectRes.ok()).toBeTruthy();
      const json = JSON.parse(await inspectRes.text());
      expect(json?.status).toBe("PENDING");
      // hold should still exist
      expect(json?.holdExpiresAt).not.toBeNull();
    }

    // -- 4) Send async success to represent 3DS approval
    const asyncPayloadObj = {
      id: `evt_test_async_succeeded_${Date.now()}`,
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
            pm_type: "card_3ds",
          },
          payment_intent: {
            id: piId,
            object: "payment_intent",
            status: "succeeded",
          },
          amount_total: 23456,
        },
      },
    };
    const asyncPayload = JSON.stringify(asyncPayloadObj);
    const asyncSig = Stripe.webhooks.generateTestHeaderString({
      payload: asyncPayload,
      secret: SIGNING_SECRET!,
    });

    const asyncRes = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      headers: {
        "stripe-signature": asyncSig,
        "content-type": "application/json",
      },
      data: asyncPayload,
    });
    expect(
      asyncRes.ok(),
      `async webhook failed: ${await asyncRes.text()}`
    ).toBeTruthy();

    // -- 5) Poll until CONFIRMED with PI attached and hold cleared
    let status = "PENDING";
    let depositPaid = false;
    let stripePaymentIntentId: string | null = null;
    let holdExpiresAt: string | null = "non-null";

    for (let i = 0; i < 10; i++) {
      const inspectRes = await request.get(
        `${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`,
        { headers: { "cache-control": "no-store" } }
      );
      expect(inspectRes.ok()).toBeTruthy();
      const json = JSON.parse(await inspectRes.text());

      status = json?.status ?? status;
      depositPaid = json?.depositPaid ?? depositPaid;
      stripePaymentIntentId =
        json?.stripePaymentIntentId ?? stripePaymentIntentId;

      if (Object.prototype.hasOwnProperty.call(json, "holdExpiresAt")) {
        holdExpiresAt = json.holdExpiresAt;
      }

      if (status === "CONFIRMED" && depositPaid && stripePaymentIntentId) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    expect(status).toBe("CONFIRMED");
    expect(depositPaid).toBe(true);
    expect(stripePaymentIntentId).toBe(piId);
    expect(holdExpiresAt).toBeNull();
  });
});

test("replaying async success is idempotent", async ({ request }) => {
  // 1) Fresh PENDING booking
  const { bookingId, startDate, endDate, machineId } =
    await createBookingWithRetry(request);

  // Keep session/PI stable across all events
  const sessionId = `cs_test_${Date.now()}`;
  const piId = `pi_test_${Date.now()}`;

  // 2) Send 'completed' with unpaid (defer promotion)
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
        payment_status: "unpaid",
        client_reference_id: String(bookingId),
        metadata: {
          bookingId: String(bookingId),
          machineId: String(machineId),
          startDate,
          endDate,
          flow: "full_upfront",
          pm_type: "card_3ds",
        },
        payment_intent: { id: piId, object: "payment_intent", status: "requires_action" },
        amount_total: 23456,
      },
    },
  });
  const completedSig = Stripe.webhooks.generateTestHeaderString({
    payload: completedPayload,
    secret: SIGNING_SECRET!,
  });
  const completedRes = await request.post(`${BASE_URL}/api/stripe/webhook`, {
    headers: { "stripe-signature": completedSig, "content-type": "application/json" },
    data: completedPayload,
  });
  expect(completedRes.ok(), `completed webhook failed: ${await completedRes.text()}`).toBeTruthy();

  // 3) Send async success (promote to CONFIRMED)
  const asyncPayload1 = JSON.stringify({
    id: `evt_test_async_succeeded_${Date.now()}`,
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
          pm_type: "card_3ds",
        },
        payment_intent: { id: piId, object: "payment_intent", status: "succeeded" },
        amount_total: 23456,
      },
    },
  });
  const asyncSig1 = Stripe.webhooks.generateTestHeaderString({
    payload: asyncPayload1,
    secret: SIGNING_SECRET!,
  });
  const asyncRes1 = await request.post(`${BASE_URL}/api/stripe/webhook`, {
    headers: { "stripe-signature": asyncSig1, "content-type": "application/json" },
    data: asyncPayload1,
  });
  expect(asyncRes1.ok(), `async webhook(1) failed: ${await asyncRes1.text()}`).toBeTruthy();

  // Poll until CONFIRMED
  let status = "PENDING";
  let stripePaymentIntentId: string | null = null;
  for (let i = 0; i < 10; i++) {
    const res = await request.get(`${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`, {
      headers: { "cache-control": "no-store" },
    });
    expect(res.ok()).toBeTruthy();
    const json = JSON.parse(await res.text());
    status = json?.status ?? status;
    stripePaymentIntentId = json?.stripePaymentIntentId ?? stripePaymentIntentId;
    if (status === "CONFIRMED" && stripePaymentIntentId) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  expect(status).toBe("CONFIRMED");
  expect(stripePaymentIntentId).toBe(piId);

  // 4) Replay the SAME async success (simulate Stripe double-delivery)
  const asyncPayload2 = asyncPayload1; // exact same body is fine
  const asyncSig2 = Stripe.webhooks.generateTestHeaderString({
    payload: asyncPayload2,
    secret: SIGNING_SECRET!,
  });
  const asyncRes2 = await request.post(`${BASE_URL}/api/stripe/webhook`, {
    headers: { "stripe-signature": asyncSig2, "content-type": "application/json" },
    data: asyncPayload2,
  });
  expect(asyncRes2.ok(), `async webhook(2) failed: ${await asyncRes2.text()}`).toBeTruthy();

  // Assert: still CONFIRMED, PI unchanged, no regression
  const finalRes = await request.get(`${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`, {
    headers: { "cache-control": "no-store" },
  });
  expect(finalRes.ok()).toBeTruthy();
  const finalJson = JSON.parse(await finalRes.text());
  expect(finalJson?.status).toBe("CONFIRMED");
  expect(finalJson?.stripePaymentIntentId).toBe(piId);
  expect(finalJson?.holdExpiresAt).toBeNull();
});
