import { describe, it, expect, beforeEach, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

// ⚠️ Mock the Prisma db used by webhook-service BEFORE importing it.
type Row = {
  id: number;
  status: BookingStatus;
  stripePaymentIntentId: string | null;
  depositPaid: boolean;
  holdExpiresAt: Date | null;
};

// A tiny in-memory Prisma-like store + counters
const __store = new Map<number, Row>();
const __counters = { updateCalls: 0, updateManyCalls: 0 };

vi.mock("@/lib/db", () => {
  // Helpers to match Prisma's select shape (we only need a few fields)
  function pick<T extends object>(obj: T, select?: Record<string, boolean>): any {
    if (!select) return obj;
    const out: any = {};
    for (const k of Object.keys(select)) out[k] = (obj as any)[k];
    return out;
  }

  const booking = {
    async findUnique(opts: { where: { id: number }, select?: Record<string, boolean> }) {
      const row = __store.get(opts.where.id) || null;
      return row ? pick(row, opts.select) : null;
    },
    async update(opts: { where: { id: number }, data: Partial<Row> }) {
      __counters.updateCalls++;
      const row = __store.get(opts.where.id);
      if (!row) throw new Error("Not found");
      const next = { ...row, ...opts.data } as Row;
      __store.set(opts.where.id, next);
      return next;
    },
    async updateMany(opts: { where: Partial<Row> & { id?: number }, data: Partial<Row> }) {
      __counters.updateManyCalls++;
      let count = 0;
      for (const [id, row] of __store.entries()) {
        const idOk = opts.where.id == null || opts.where.id === id;
        const statusOk = opts.where.status == null || opts.where.status === row.status;
        if (idOk && statusOk) {
          __store.set(id, { ...row, ...opts.data } as Row);
          count++;
        }
      }
      return { count };
    },
  };

  // $transaction just calls back with a tx view that exposes booking
  const db = {
    async $transaction<T>(cb: (tx: { booking: typeof booking; $executeRaw?: unknown }) => Promise<T>) {
      return cb({ booking });
    },
    booking,
  };

  return { db };
});

// Import after the mock is defined
import {
  promoteBookingToConfirmed,
  cancelPendingBooking,
} from "../../../lib/stripe/webhook-service";

function resetStore() {
  __store.clear();
  __counters.updateCalls = 0;
  __counters.updateManyCalls = 0;
}

describe("webhook-service idempotency", () => {
  beforeEach(() => {
    resetStore();
  });

  it("promotes booking exactly once and is idempotent on retries", async () => {
    // Seed a PENDING booking with a hold
    const bookingId = 42;
    __store.set(bookingId, {
      id: bookingId,
      status: BookingStatus.PENDING,
      stripePaymentIntentId: null,
      depositPaid: false,
      holdExpiresAt: new Date(),
    });

    const logs: Array<{ e: string; d?: Record<string, unknown> }> = [];
    const log = (e: string, d?: Record<string, unknown>) => logs.push({ e, d });

    // First promotion should update row
    await promoteBookingToConfirmed(
      { bookingId, paymentIntentId: "pi_abc" },
      log
    );

    const afterFirst = __store.get(bookingId)!;
    expect(afterFirst.status).toBe(BookingStatus.CONFIRMED);
    expect(afterFirst.depositPaid).toBe(true);
    expect(afterFirst.stripePaymentIntentId).toBe("pi_abc");
    expect(afterFirst.holdExpiresAt).toBeNull();
    expect(__counters.updateCalls).toBe(1);
    expect(logs.some((l) => l.e === "promote:updated")).toBe(true);

    // Second promotion (retry) should be a no-op
    await promoteBookingToConfirmed(
      { bookingId, paymentIntentId: "pi_abc" },
      log
    );

    const afterSecond = __store.get(bookingId)!;
    expect(afterSecond.status).toBe(BookingStatus.CONFIRMED);
    expect(afterSecond.depositPaid).toBe(true);
    expect(__counters.updateCalls).toBe(1); // still only one update
    expect(logs.some((l) => l.e === "promote:already_confirmed")).toBe(true);
  });

  it("cancelPendingBooking cancels only when status=PENDING", async () => {
    const pendingId = 77;
    const confirmedId = 78;

    __store.set(pendingId, {
      id: pendingId,
      status: BookingStatus.PENDING,
      stripePaymentIntentId: null,
      depositPaid: false,
      holdExpiresAt: new Date(),
    });
    __store.set(confirmedId, {
      id: confirmedId,
      status: BookingStatus.CONFIRMED,
      stripePaymentIntentId: "pi_xyz",
      depositPaid: true,
      holdExpiresAt: null,
    });

    const logs: Array<{ e: string; d?: Record<string, unknown> }> = [];
    const log = (e: string, d?: Record<string, unknown>) => logs.push({ e, d });

    await cancelPendingBooking(pendingId, log);
    await cancelPendingBooking(confirmedId, log);

    const p = __store.get(pendingId)!;
    const c = __store.get(confirmedId)!;

    expect(p.status).toBe(BookingStatus.CANCELLED);
    expect(p.holdExpiresAt).toBeNull();
    expect(c.status).toBe(BookingStatus.CONFIRMED); // unchanged

    // updateMany was called twice, once for each attempt
    expect(__counters.updateManyCalls).toBe(2);
    // Log includes count (first should be 1, second 0) – we just assert presence
    expect(logs.some((l) => l.e === "expired:cancelled_pending")).toBe(true);
  });
});
