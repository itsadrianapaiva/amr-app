import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";

/**
 * Mock "@/lib/stripe" and capture the `sessions.create` mock by reading it
 * back via `getStripe()` in the test (no fake exports needed).
 */
vi.mock("@/lib/stripe", () => {
  // Use no generics on vi.fn to avoid TS2558; annotate params to avoid TS7006.
  const create = vi.fn(async (_params: any, _opts?: any) => {
    return {
      id: "cs_test_123",
      url: "https://example.test/checkout",
      payment_intent: "pi_123",
    };
  });

  return {
    getStripe: () => ({
      checkout: { sessions: { create } },
    }),
  };
});

// Import SUT after the mock so it binds to the mocked module
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";
// Also import getStripe so we can reach the same mock function for assertions
import { getStripe } from "@/lib/stripe";

describe("createCheckoutSessionWithGuards", () => {
  it("mirrors bookingId and start/end dates into PaymentIntent metadata", async () => {
    const rawParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      client_reference_id: "booking-42",
      metadata: {
        bookingId: "42",
        startDate: "2025-10-01",
        endDate: "2025-10-03",
      },
      customer_email: "test@example.com",
      line_items: [
        {
          price_data: {
            unit_amount: 12345,
            currency: "eur",
            product_data: { name: "Rental" },
            tax_behavior: "exclusive",
          },
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
    };

    await createCheckoutSessionWithGuards(rawParams, {
      idempotencyKey: "unit-test-key",
    });

    // Reach the same mock function instance via the mocked module
    const stripe = getStripe() as any;
    const createMock = stripe.checkout.sessions.create as any;

    expect(createMock.mock.calls.length).toBe(1);

    const passedParams =
      createMock.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;

    // Session metadata contains bookingId + dates
    expect(passedParams.metadata?.bookingId).toBe("42");
    expect(passedParams.metadata?.startDate).toBe("2025-10-01");
    expect(passedParams.metadata?.endDate).toBe("2025-10-03");

    // PaymentIntent metadata mirrors the same keys
    const piMeta = passedParams.payment_intent_data
      ?.metadata as Record<string, string> | undefined;
    expect(piMeta?.bookingId).toBe("42");
    expect(piMeta?.startDate).toBe("2025-10-01");
    expect(piMeta?.endDate).toBe("2025-10-03");

    // Idempotency key forwarded as second arg to stripe.create(...)
    const passedOpts = createMock.mock.calls[0][1];
    expect(passedOpts?.idempotencyKey).toBe("unit-test-key");
  });
});
