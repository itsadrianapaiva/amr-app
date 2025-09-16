// tests/unit/stripe/handlers/charge.refund.updated.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { onChargeRefundUpdated } from "@/lib/stripe/handlers/charge/refund-updated";

/**
 * Hoisted shared state for mocks. Required because vi.mock is hoisted.
 */
const store = vi.hoisted(() => {
  const mem = {
    stripeEvents: new Set<string>(),
    booking: {
      id: 77,
      stripePaymentIntentId: "pi_abc",
      refundIds: [] as string[],
      refundedAmountCents: 0,
      refundStatus: "NONE" as "NONE" | "PARTIAL" | "FULL",
      stripeChargeId: null as string | null,
    },
    // Fake Stripe "database"
    stripe: {
      chargeById: new Map<
        string,
        {
          id: string;
          amount: number;
          amount_refunded: number;
          payment_intent: string;
        }
      >(),
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
 * Mock Prisma client used by the handler
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
    booking: { findUnique: bookingFindUnique, update: bookingUpdate },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        booking: { findUnique: bookingFindUnique, update: bookingUpdate },
      };
      return fn.length > 0 ? fn(tx) : fn();
    }),
  };

  return { db };
});

/**
 * Mock Stripe client returned by getStripe()
 * The handler calls charges.retrieve and sometimes charges.list.
 */
vi.mock("@/lib/stripe", () => {
  const getStripe = () => ({
    charges: {
      retrieve: vi.fn(async (id: string) => {
        const rec = store.mem.stripe.chargeById.get(id);
        if (!rec) throw new Error("not found");
        return rec;
      }),
      list: vi.fn(async ({ payment_intent }: any) => {
        const arr: any[] = [];
        for (const v of store.mem.stripe.chargeById.values()) {
          if (v.payment_intent === payment_intent) arr.push(v);
        }
        return { data: arr };
      }),
    },
  });
  return { getStripe };
});

// Simple logger
const log = (_e: string, _d?: Record<string, unknown>) => {};

// Build a Stripe.Event<Stripe.Refund>
function eventRefundUpdated(
  evtId: string,
  opts: { refundId?: string; chargeId?: string } = {}
): Stripe.Event {
  const { refundId = "re_x", chargeId = "ch_x" } = opts;
  const refund: any = {
    id: refundId,
    object: "refund",
    charge: chargeId,
    status: "succeeded",
  };
  return {
    id: evtId,
    type: "charge.refund.updated",
    created: Math.floor(Date.now() / 1000),
    data: { object: refund },
  } as unknown as Stripe.Event;
}

describe("onChargeRefundUpdated", () => {
  beforeEach(() => {
    mem.stripeEvents.clear();
    mem.booking.refundIds = [];
    mem.booking.refundedAmountCents = 0;
    mem.booking.refundStatus = "NONE";
    mem.booking.stripeChargeId = null;
    mem.stripe.chargeById.clear();
    // Seed one charge linked to the PI
    mem.stripe.chargeById.set("ch_full", {
      id: "ch_full",
      amount: 70110,
      amount_refunded: 70110,
      payment_intent: "pi_abc",
    });
    mem.stripe.chargeById.set("ch_partial", {
      id: "ch_partial",
      amount: 70110,
      amount_refunded: 8450,
      payment_intent: "pi_abc",
    });
  });

  it("recomputes FULL totals and merges refund id", async () => {
    const evt = eventRefundUpdated("evt_upd_full", {
      refundId: "re_9",
      chargeId: "ch_full",
    });

    await onChargeRefundUpdated(evt, log);

    expect(mem.booking.refundedAmountCents).toBe(70110);
    expect(mem.booking.refundStatus).toBe("FULL");
    expect(mem.booking.refundIds).toContain("re_9");
    expect(mem.booking.stripeChargeId).toBe("ch_full");
  });

  it("recomputes PARTIAL totals and merges refund id", async () => {
    const evt = eventRefundUpdated("evt_upd_partial", {
      refundId: "re_10",
      chargeId: "ch_partial",
    });

    await onChargeRefundUpdated(evt, log);

    expect(mem.booking.refundedAmountCents).toBe(8450);
    expect(mem.booking.refundStatus).toBe("PARTIAL");
    expect(mem.booking.refundIds).toContain("re_10");
    expect(mem.booking.stripeChargeId).toBe("ch_partial");
  });

  it("is idempotent on duplicate Stripe event ids", async () => {
    const evt = eventRefundUpdated("evt_dup", {
      refundId: "re_dup",
      chargeId: "ch_partial",
    });

    await onChargeRefundUpdated(evt, log);
    await onChargeRefundUpdated(evt, log);

    expect(mem.booking.refundIds.filter((x) => x === "re_dup").length).toBe(1);
    expect(mem.booking.refundStatus).toBe("PARTIAL");
  });
});
