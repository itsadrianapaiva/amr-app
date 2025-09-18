import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";

// Mocks for side-effecty modules
vi.mock("@/lib/notifications/notify-booking-confirmed", () => ({
  notifyBookingConfirmed: vi.fn().mockResolvedValue(undefined),
}));

// Mock Stripe webhook-service helpers used by the handler
const promoteBookingToConfirmed = vi.fn().mockResolvedValue(undefined);
const extractPIFacts = vi
  .fn()
  .mockReturnValue({ bookingId: 326, flow: "full_charge" });
vi.mock("@/lib/stripe/webhook-service", () => ({
  promoteBookingToConfirmed,
  extractPIFacts,
}));

// Mock invoicing entrypoint - returns a Vendus record
const maybeIssueInvoice = vi.fn().mockResolvedValue({
  provider: "vendus",
  providerInvoiceId: "777",
  number: "FT T01P2025/2",
  pdfUrl: "https://www.vendus.pt/ws/v1.1/documents/777.pdf",
  atcud: "EFGH-2",
});
vi.mock("@/lib/invoicing/issue-for-booking", () => ({
  maybeIssueInvoice,
}));

// Mock DB: booking.findUnique and booking.update
const bookingUpdate = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      findUnique: vi.fn().mockResolvedValue({
        id: 326,
        startDate: new Date("2025-09-20T00:00:00Z"),
        endDate: new Date("2025-09-23T00:00:00Z"),
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerNIF: "123456789",
        billingIsBusiness: false,
        billingAddressLine1: null,
        billingCity: null,
        billingPostalCode: null,
        billingCountry: "PT",
        machine: { name: "Excavator", dailyRate: 150 }, // number is fine
      }),
      update: bookingUpdate,
    },
  },
}));

describe("onPaymentIntentSucceeded → issues invoice and persists it", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...OLD_ENV,
      INVOICING_ENABLED: "true",
      VENDUS_DOC_TYPE: "FT",
      VENDUS_MODE: "tests",
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.clearAllMocks();
  });

  it("calls maybeIssueInvoice and updates Booking with invoice fields", async () => {
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

    // Assert promote → invoicing called
    expect(promoteBookingToConfirmed).toHaveBeenCalledWith(
      { bookingId: 326, paymentIntentId: "pi_123" },
      expect.any(Function)
    );
    expect(maybeIssueInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        stripePaymentIntentId: "pi_123",
        booking: expect.objectContaining({
          id: 326,
          machineName: "Excavator",
          unitDailyCents: 15000, // 150 * 100
          vatPercent: 23,
        }),
      })
    );

    // Assert DB update with invoice fields
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: 326 },
      data: expect.objectContaining({
        invoiceProvider: "vendus",
        invoiceProviderId: "777",
        invoiceNumber: "FT T01P2025/2",
        invoicePdfUrl: "https://www.vendus.pt/ws/v1.1/documents/777.pdf",
        invoiceAtcud: "EFGH-2",
      }),
    });
  });
});
