// tests/unit/stripe/handlers/charge.refunded.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { onChargeRefunded } from "@/lib/stripe/handlers/charge/refunded";

/**
 * Hoisted shared state for the module mock AND the tests.
 * Vitest moves vi.mock to the top, so anything it uses must be defined via vi.hoisted.
 */
const store = vi.hoisted(() => {
  const mem = {
    stripeEvents: new Set<string>(),
    booking: {
      id: 42,
      stripePaymentIntentId: "pi_123",
      refundIds: [] as string[],
      refundedAmountCents: 0,
      refundStatus: "NONE" as "NONE" | "PARTIAL" | "FULL",
      stripeChargeId: null as string | null,
      totalCost: { toNumber: () => 701.1 },
    },
  };
  function uniqueViolation() {
    const err: any = new Error("Unique constraint violation");
    err.code = "P2002";
    return err;
  }
  return { mem, uniqueViolation };
});
const { mem, uniqueViolation } = store;

/**
 * Mock Prisma client used by the handler. All functions live INSIDE the mock
 * factory and reference the hoisted `store.mem`.
 */
vi.mock("@/lib/db", () => {
  const stripeEventCreate = vi.fn(async ({ data }: any) => {
    if (store.mem.stripeEvents.has(data.eventId)) throw uniqueViolation();
    store.mem.stripeEvents.add(data.eventId);
    return { id: 1, ...data };
  });

  const bookingFindUnique = vi.fn(async ({ where, select }: any) => {
    if (
      where.stripePaymentIntentId === store.mem.booking.stripePaymentIntentId
    ) {
      const out: any = {};
      for (const k of Object.keys(select))
        out[k] = (store.mem.booking as any)[k];
      return out;
    }
    return null;
  });

  const bookingUpdate = vi.fn(async ({ where, data }: any) => {
    if (where.id !== store.mem.booking.id) throw new Error("Booking not found");
    store.mem.booking.refundedAmountCents =
      data.refundedAmountCents ?? store.mem.booking.refundedAmountCents;
    store.mem.booking.refundStatus =
      data.refundStatus ?? store.mem.booking.refundStatus;
    store.mem.booking.refundIds = data.refundIds ?? store.mem.booking.refundIds;
    store.mem.booking.stripeChargeId =
      data.stripeChargeId ?? store.mem.booking.stripeChargeId;
    return { ...store.mem.booking };
  });

  const db = {
    stripeEvent: { create: stripeEventCreate },
    booking: {
      findUnique: bookingFindUnique,
      update: bookingUpdate,
    },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        booking: {
          findUnique: bookingFindUnique,
          update: bookingUpdate,
        },
      };
      // Support both fn(tx) and fn()
      return fn.length > 0 ? fn(tx) : fn();
    }),
  };

  return { db };
});

// Simple logger
const log = (_e: string, _data?: Record<string, unknown>) => {};

// Helper to build a minimal Stripe.Event for charge.refunded
function eventChargeRefunded(
  evtId: string,
  opts: {
    chargeId?: string;
    amount?: number;
    amount_refunded?: number;
    piId?: string;
    refundIds?: string[];
  } = {}
): Stripe.Event {
  const {
    chargeId = "ch_123",
    amount = 70110,
    amount_refunded = 70110,
    piId = "pi_123",
    refundIds = [],
  } = opts;

  const charge: any = {
    id: chargeId,
    object: "charge",
    amount,
    amount_refunded,
    payment_intent: piId,
    refunds: { data: refundIds.map((id) => ({ id })) },
  };

  return {
    id: evtId,
    type: "charge.refunded",
    created: Math.floor(Date.now() / 1000),
    data: { object: charge },
  } as unknown as Stripe.Event;
}

describe("onChargeRefunded", () => {
  beforeEach(() => {
    mem.stripeEvents.clear();
    mem.booking.refundIds = [];
    mem.booking.refundedAmountCents = 0;
    mem.booking.refundStatus = "NONE";
    mem.booking.stripeChargeId = null;
  });

  it("updates booking as FULL when amount_refunded equals charge amount", async () => {
    const evt = eventChargeRefunded("evt_full", {
      amount: 70110,
      amount_refunded: 70110,
      refundIds: ["re_1"],
    });

    await onChargeRefunded(evt, log);

    expect(mem.booking.refundedAmountCents).toBe(70110);
    expect(mem.booking.refundStatus).toBe("FULL");
    expect(mem.booking.refundIds).toContain("re_1");
    expect(mem.stripeEvents.has("evt_full")).toBe(true);
  });

  it("updates booking as PARTIAL when amount_refunded < charge amount", async () => {
    const evt = eventChargeRefunded("evt_partial", {
      amount: 70110,
      amount_refunded: 8450,
      refundIds: ["re_2"],
    });

    await onChargeRefunded(evt, log);

    expect(mem.booking.refundedAmountCents).toBe(8450);
    expect(mem.booking.refundStatus).toBe("PARTIAL");
    expect(mem.booking.refundIds).toContain("re_2");
  });

  it("is idempotent on Stripe event retries", async () => {
    const evt = eventChargeRefunded("evt_dup", {
      amount: 70110,
      amount_refunded: 70110,
      refundIds: ["re_first"],
    });

    await onChargeRefunded(evt, log);
    await onChargeRefunded(evt, log);

    expect(mem.booking.refundedAmountCents).toBe(70110);
    expect(mem.booking.refundStatus).toBe("FULL");
    expect(mem.booking.refundIds.filter((x) => x === "re_first").length).toBe(
      1
    );
  });
});
