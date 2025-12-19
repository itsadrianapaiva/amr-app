import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Mock Stripe webhook-service helpers used by the handler
const promoteBookingToConfirmed = vi.fn().mockResolvedValue(undefined);
const extractPIFacts = vi
  .fn()
  .mockReturnValue({ bookingId: 326, flow: "full_charge" });
vi.mock("@/lib/stripe/webhook-service", () => ({
  promoteBookingToConfirmed,
  extractPIFacts,
}));

// Mock job creation - the new async pattern (Phase A3)
const createBookingJobs = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/create-booking-jobs", () => ({
  createBookingJobs,
}));

describe("onPaymentIntentSucceeded → creates async jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates async jobs for invoice issuance and notifications", async () => {
    // Lazy import AFTER mocks so they apply
    const { onPaymentIntentSucceeded } = await import(
      "@/lib/stripe/handlers/payment_intent/succeeded"
    );

    // Build a minimal Stripe PI succeeded event
    const pi: Partial<Stripe.PaymentIntent> = {
      id: "pi_123",
      created: Math.floor(new Date("2025-09-18T12:00:00Z").getTime() / 1000),
      metadata: { bookingId: "326" },
    };
    const event = {
      id: "evt_1",
      type: "payment_intent.succeeded",
      livemode: false,
      data: { object: pi },
    } as unknown as Stripe.Event;

    // Simple log function
    const log = vi.fn();

    // Act
    await onPaymentIntentSucceeded(event, log);

    // Assert: promote booking to CONFIRMED
    expect(promoteBookingToConfirmed).toHaveBeenCalledWith(
      { bookingId: 326, paymentIntentId: "pi_123" },
      expect.any(Function)
    );

    // Assert: jobs created for invoice issuance and notifications
    expect(createBookingJobs).toHaveBeenCalledWith(
      326, // bookingId
      [
        {
          type: "issue_invoice",
          payload: { stripePaymentIntentId: "pi_123" },
        },
        {
          type: "send_customer_confirmation",
          payload: {},
        },
        {
          type: "send_internal_confirmation",
          payload: {},
        },
      ],
      expect.any(Function) // log function
    );
  });
});
