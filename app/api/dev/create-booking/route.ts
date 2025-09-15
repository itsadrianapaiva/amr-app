import { NextResponse } from "next/server";
import {
  createOrReusePendingBooking,
  type PendingBookingDTO,
} from "@/lib/repos/booking-repo";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────────── helpers: input coercion ───────────────────────── */

function toDto(input: {
  machineId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  totalEuros?: unknown;
  siteAddress?: {
    line1?: unknown;
    postalCode?: unknown;
    city?: unknown;
    notes?: unknown;
  } | null;
}): PendingBookingDTO {
  const machineId = Number(input.machineId ?? 1);
  const from = new Date(String(input.startDate ?? new Date()));
  const to = new Date(String(input.endDate ?? new Date()));
  const name = String(input.name ?? "Test User");
  const email = String(input.email ?? "test@example.com");
  const phone = String(input.phone ?? "+351000000000");
  const totalEuros = Number(input.totalEuros ?? 100);

  return {
    machineId,
    startDate: from,
    endDate: to,

    // Add-ons off by default for tests
    insuranceSelected: false,
    deliverySelected: false,
    pickupSelected: false,
    operatorSelected: false,

    customer: { name, email, phone, nif: null },

    siteAddress: {
      line1: (input.siteAddress?.line1 as string | null) ?? null,
      postalCode: (input.siteAddress?.postalCode as string | null) ?? null,
      city: (input.siteAddress?.city as string | null) ?? null,
      notes: (input.siteAddress?.notes as string | null) ?? null,
    },

    billing: {
      isBusiness: false,
      companyName: null,
      taxId: null,
      addressLine1: null,
      postalCode: null,
      city: null,
      country: "PT",
    },

    totals: { total: totalEuros },
  };
}

function allowE2E(req: Request): boolean {
  const secret = process.env["E2E_SECRET"];
  if (!secret) return false;
  const header = req.headers.get("x-e2e-secret");
  return header === secret;
}

function forbidProd(req: Request) {
  if (process.env.NODE_ENV === "production" && !allowE2E(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return null;
}

function coerceExpiredFlag(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

function coerceMinutes(v: unknown, fallback = 5) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/* ────────────── ensure a valid machineId in non-production ───────────── */

async function resolveMachineIdForEnv(machineId: number): Promise<number> {
  // If the machine exists, keep it.
  const exists = await db.machine.findUnique({
    where: { id: machineId },
    select: { id: true },
  });
  if (exists) return machineId;

  // In production, fail loudly — routes must use real machine IDs.
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Unknown machineId ${machineId}.`);
  }

  // In tests/dev, auto-fallback to the first machine to avoid FK 400s on CI.
  const first = await db.machine.findFirst({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (!first) {
    // Clear message so CI points you to seeding immediately.
    throw new Error(
      "No machines exist in the database. Run `npm run db:seed` (or ensure seed runs in CI)."
    );
  }

  return first.id;
}

/* ───────────── small core: create + optional expired override (test) ───────── */

type CreateResult = {
  id: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  holdExpiresAt: Date | null;
};

async function createWithOptionalExpired(
  dto: PendingBookingDTO,
  expired: boolean,
  minutes: number
): Promise<CreateResult> {
  const created = await createOrReusePendingBooking(dto);

  if (expired) {
    const holdExpiresAt = new Date(Date.now() - minutes * 60 * 1000);
    const updated = await db.booking.update({
      where: { id: created.id },
      data: { status: "PENDING", holdExpiresAt },
      select: { id: true, status: true, holdExpiresAt: true },
    });
    return updated as CreateResult;
  }

  const fresh = await db.booking.findUnique({
    where: { id: created.id },
    select: { id: true, status: true, holdExpiresAt: true },
  });

  return (fresh ?? {
    id: created.id,
    status: "PENDING",
    holdExpiresAt: null,
  }) as CreateResult;
}

/* ────────────────────────────────── routes ────────────────────────────────── */

export async function POST(req: Request) {
  const deny = forbidProd(req);
  if (deny) return deny;

  try {
    const body = await req.json();
    const base = toDto(body);

    // ensure a valid machineId in non-prod environments
    const machineId = await resolveMachineIdForEnv(base.machineId);
    const dto: PendingBookingDTO = { ...base, machineId };

    const expired = coerceExpiredFlag((body as any)?.expired);
    const minutes = coerceMinutes((body as any)?.minutes, 5);

    const result = await createWithOptionalExpired(dto, expired, minutes);

    return NextResponse.json({
      ok: true,
      bookingId: result.id,
      status: result.status,
      holdExpiresAt: result.holdExpiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const deny = forbidProd(req);
  if (deny) return deny;

  try {
    const url = new URL(req.url);
    const base = toDto({
      machineId: url.searchParams.get("machineId") ?? undefined,
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
      name: url.searchParams.get("name") ?? undefined,
      email: url.searchParams.get("email") ?? undefined,
      phone: url.searchParams.get("phone") ?? undefined,
      totalEuros: url.searchParams.get("totalEuros") ?? undefined,
      siteAddress: {
        line1: url.searchParams.get("line1") ?? undefined,
        postalCode: url.searchParams.get("postalCode") ?? undefined,
        city: url.searchParams.get("city") ?? undefined,
        notes: url.searchParams.get("notes") ?? undefined,
      },
    });

    // NEW: ensure a valid machineId in non-prod environments
    const machineId = await resolveMachineIdForEnv(base.machineId);
    const dto: PendingBookingDTO = { ...base, machineId };

    const expired = coerceExpiredFlag(url.searchParams.get("expired"));
    const minutes = coerceMinutes(url.searchParams.get("minutes"), 5);

    const result = await createWithOptionalExpired(dto, expired, minutes);

    return NextResponse.json({
      ok: true,
      bookingId: result.id,
      status: result.status,
      holdExpiresAt: result.holdExpiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
