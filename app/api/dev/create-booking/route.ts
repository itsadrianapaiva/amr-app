import { NextResponse } from "next/server";
import {
  createOrReusePendingBooking,
  type PendingBookingDTO,
} from "@/lib/repos/booking-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── internal: build DTO from either JSON body (POST) or query params (GET)
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

function forbidProd() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const deny = forbidProd();
  if (deny) return deny;

  try {
    const body = await req.json();
    const dto = toDto(body);
    const created = await createOrReusePendingBooking(dto);
    return NextResponse.json({ ok: true, bookingId: created.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const deny = forbidProd();
  if (deny) return deny;

  try {
    const url = new URL(req.url);
    const dto = toDto({
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
    const created = await createOrReusePendingBooking(dto);
    return NextResponse.json({ ok: true, bookingId: created.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
