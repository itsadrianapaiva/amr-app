import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildFullCheckoutSessionParams } from "@/lib/stripe/checkout.full";
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ——— small local helpers (pure) ———
function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  );
}

function toIsoDay(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
}

// Inclusive calendar days (start & end included)
function inclusiveDays(start: Date, end: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((b - a) / ms) + 1);
}

/**
 * DEV-ONLY
 * POST /api/dev/checkout-for-booking
 * Body: { bookingId: number, totalEuros?: number }
 *
 * Creates a real Stripe Checkout Session for an existing PENDING booking and
 * returns the session URL. In dev/tests you may pass `totalEuros` to avoid
 * coupling to pricing internals. If omitted, we fall back to machine.dailyRate * days.
 */
export async function POST(req: NextRequest) {

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bookingId = Number((body as any)?.bookingId);
  const overrideTotal = (body as any)?.totalEuros;
  const overrideTotalEuros =
    overrideTotal !== undefined ? Number(overrideTotal) : undefined;

  if (!Number.isFinite(bookingId)) {
    return NextResponse.json(
      { error: "bookingId must be a number." },
      { status: 400 }
    );
  }

  // Fetch booking with only the fields we need (no `totals` here)
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      machineId: true,
      startDate: true,
      endDate: true,
      customerEmail: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // Fetch machine so we can derive a fallback total if needed
  const machine = await db.machine.findUnique({
    where: { id: booking.machineId },
    select: { id: true, name: true, dailyRate: true },
  });
  if (!machine) {
    return NextResponse.json({ error: "Machine not found." }, { status: 404 });
  }

  const from = new Date(booking.startDate);
  const to = new Date(booking.endDate);
  const days = inclusiveDays(from, to);

  // Prefer explicit override (test-controlled), else derive a minimal fallback
  let totalEuros: number | undefined = undefined;
  if (overrideTotalEuros !== undefined && Number.isFinite(overrideTotalEuros) && overrideTotalEuros > 0) {
    totalEuros = overrideTotalEuros;
  } else if (machine.dailyRate != null) {
    // Prisma Decimal -> Number is acceptable in tests/dev; production code should be careful with money.
    const rate = Number(machine.dailyRate as unknown as number);
    if (Number.isFinite(rate) && rate > 0) totalEuros = rate * days;
  }

  if (!Number.isFinite(totalEuros) || (totalEuros as number) <= 0) {
    return NextResponse.json(
      { error: "Could not determine a valid total. Provide totalEuros in the request." },
      { status: 400 }
    );
  }

  const appUrl = appBaseUrl();
  const params = buildFullCheckoutSessionParams({
    bookingId: booking.id,
    machine: { id: machine.id, name: machine.name ?? `Machine ${machine.id}` },
    from,
    to,
    days,
    totalEuros: totalEuros as number,
    customerEmail: booking.customerEmail ?? undefined,
    appUrl,
  });

  const session = await createCheckoutSessionWithGuards(params, {
    idempotencyKey: `dev-booking-${booking.id}-full`,
    log: (event, data) => console.debug(`[dev:checkout] ${event}`, data),
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      url: session.url,
      bookingId: booking.id,
      from: toIsoDay(from),
      to: toIsoDay(to),
      days,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
