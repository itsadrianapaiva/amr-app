import { describe, it, expect } from "vitest";
import {
  getMetaFromCheckoutSession,
  getPaymentIntentId,
  isPaymentComplete,
  type MinimalCheckoutSession,
} from "../../../lib/stripe/checkout-session";

// Tiny builder so each test can specify only the fields it needs
function s(partial: Partial<MinimalCheckoutSession>): MinimalCheckoutSession {
  return { ...partial };
}

describe("checkout-session helpers", () => {
  describe("getMetaFromCheckoutSession", () => {
    it("extracts bookingId from client_reference_id and converts to number", () => {
      const out = getMetaFromCheckoutSession(
        s({ client_reference_id: "42", metadata: {} })
      );
      expect(out.bookingId).toBe(42);
    });

    it("reads machineId and dates from metadata with type safety", () => {
      const out = getMetaFromCheckoutSession(
        s({
          client_reference_id: "7",
          metadata: {
            machineId: "5",
            startDate: "2025-09-10",
            endDate: "2025-09-12",
          },
        })
      );
      expect(out.machineId).toBe(5);
      expect(out.startDate).toBe("2025-09-10");
      expect(out.endDate).toBe("2025-09-12");
    });

    it("returns NaN bookingId when not a finite number and leaves machineId undefined", () => {
      const out = getMetaFromCheckoutSession(
        s({ client_reference_id: "abc", metadata: { machineId: "nope" } })
      );
      expect(Number.isNaN(out.bookingId)).toBe(true);
      expect(out.machineId).toBeUndefined();
    });
  });

  describe("getPaymentIntentId", () => {
    it("returns PI id when session holds a string id", () => {
      expect(getPaymentIntentId(s({ payment_intent: "pi_123" }))).toBe("pi_123");
    });

    it("returns PI id when session holds an expanded object", () => {
      expect(getPaymentIntentId(s({ payment_intent: { id: "pi_456" } }))).toBe(
        "pi_456"
      );
    });

    it("returns null when PI is absent", () => {
      expect(getPaymentIntentId(s({}))).toBeNull();
    });
  });

  describe("isPaymentComplete", () => {
    it("treats payment_status=paid as complete", () => {
      expect(isPaymentComplete(s({ payment_status: "paid" }))).toBe(true);
    });

    it("treats status=complete as complete", () => {
      expect(isPaymentComplete(s({ status: "complete" }))).toBe(true);
    });

    it("treats expanded payment_intent.status=succeeded as complete", () => {
      expect(
        isPaymentComplete(s({ payment_intent: { status: "succeeded" } }))
      ).toBe(true);
    });

    it("returns false for processing or requires_action states", () => {
      expect(
        isPaymentComplete(s({ payment_intent: { status: "processing" } }))
      ).toBe(false);
      expect(
        isPaymentComplete(s({ payment_intent: { status: "requires_action" } }))
      ).toBe(false);
    });
  });
});
