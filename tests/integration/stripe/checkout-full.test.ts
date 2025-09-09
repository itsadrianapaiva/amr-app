import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";
import { buildFullCheckoutSessionParams } from "../../../lib/stripe/checkout.full";

// Use fixed UTC dates so iso formatting is stable across machines/timezones.
const FROM = new Date(Date.UTC(2025, 8, 10, 12)); // 2025-09-10T12:00:00Z
const TO   = new Date(Date.UTC(2025, 8, 12, 12)); // 2025-09-12T12:00:00Z

function makeArgs(overrides: Partial<Parameters<typeof buildFullCheckoutSessionParams>[0]> = {}) {
  return {
    bookingId: 77,
    machine: { id: 5, name: "Mini Excavator 1.8T" },
    from: FROM,
    to: TO,
    days: 3,
    totalEuros: 345.67, // pre-VAT
    customerEmail: "user@example.com",
    appUrl: "http://localhost:3000",
    ...overrides,
  };
}

const ENV_KEY = "STRIPE_TAX_RATE_PT_STANDARD";
let envBackup: string | undefined;

beforeEach(() => {
  envBackup = process.env[ENV_KEY];
  process.env[ENV_KEY] = "txr_test_pt_vat_23";
});

afterEach(() => {
  if (envBackup === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = envBackup;
});

describe("buildFullCheckoutSessionParams", () => {
  it("builds mode=payment session with fixed PT VAT tax rate and exclusive tax", () => {
    const params = buildFullCheckoutSessionParams(makeArgs());

    expect(params.mode).toBe("payment");
    expect(params.customer_creation).toBe("always");
    expect(params.customer_email).toBe("user@example.com");

    // Policy: fixed Tax Rate, not Automatic Tax and no tax ID collection.
    expect((params as any).automatic_tax).toBeUndefined();
    expect((params as any).tax_id_collection).toBeUndefined();

    expect(params.billing_address_collection).toBe("auto");

    expect(params.metadata).toMatchObject({
      bookingId: "77",
      machineId: "5",
      startDate: expect.any(String),
      endDate: expect.any(String),
      flow: "full_upfront",
    });
    expect(params.client_reference_id).toBe("77");

    expect("payment_method_types" in params).toBe(false);

    expect(params.line_items).toHaveLength(1);
    const item = params.line_items![0]!;
    expect(item.price_data?.unit_amount).toBe(Math.round(345.67 * 100));
    expect(item.price_data?.currency).toBe("eur");
    expect(item.price_data?.tax_behavior).toBe("exclusive");
    expect(item.price_data?.product_data?.name).toContain("Mini Excavator 1.8T");
    expect(typeof item.price_data?.product_data?.description).toBe("string");
    expect((item.price_data?.product_data?.description ?? "").length).toBeGreaterThan(0);
    expect(item.tax_rates).toEqual(["txr_test_pt_vat_23"]);
    expect(item.quantity).toBe(1);

    expect(params.success_url).toBe(
      "http://localhost:3000/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=77"
    );
    expect(params.cancel_url).toBe("http://localhost:3000/machine/5?checkout=cancelled");
  });

  it("includes payment_method_types only when override is provided", () => {
    // Some Stripe SDK versions might not yet include 'mb_way' in the union.
    // Casting keeps the test compatible while still asserting runtime behavior.
    const override = ["card", "sepa_debit", "mb_way"] as unknown as Stripe.Checkout.SessionCreateParams.PaymentMethodType[];

    const params = buildFullCheckoutSessionParams(
      makeArgs({ paymentMethodTypes: override })
    );

    expect(params.payment_method_types).toEqual(["card", "sepa_debit", "mb_way"]);
  });

  it("throws when STRIPE_TAX_RATE_PT_STANDARD env var is missing", () => {
    delete process.env[ENV_KEY];
    expect(() => buildFullCheckoutSessionParams(makeArgs())).toThrowError(
      /STRIPE_TAX_RATE_PT_STANDARD/
    );
  });
});
