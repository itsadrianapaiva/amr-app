import { NextResponse } from "next/server";
import { createOrReusePendingBooking, type PendingBookingDTO } from "@/lib/repos/booking-repo";

/** Keep this endpoint out of production. */
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();

    // Minimal fields with safe defaults for tests
    const machineId = Number(body.machineId ?? 1);
    const from = new Date(String(body.startDate));
    const to = new Date(String(body.endDate));
    const name = String(body.name ?? "Test User");
    const email = String(body.email ?? "test@example.com");
    const phone = String(body.phone ?? "+351000000000");
    const totalEuros = Number(body.totalEuros ?? 100);

    const dto: PendingBookingDTO = {
      machineId,
      startDate: from,
      endDate: to,

      // Add-ons off by default in tests
      insuranceSelected: false,
      deliverySelected: false,
      pickupSelected: false,
      operatorSelected: false,

      // Contact
      customer: { name, email, phone, nif: null },

      // Site address is optional in MVP
      siteAddress: {
        line1: body.siteAddress?.line1 ?? null,
        postalCode: body.siteAddress?.postalCode ?? null,
        city: body.siteAddress?.city ?? null,
        notes: body.siteAddress?.notes ?? null,
      },

      // Business invoicing off for tests
      billing: {
        isBusiness: false,
        companyName: null,
        taxId: null,
        addressLine1: null,
        postalCode: null,
        city: null,
        country: "PT",
      },

      // Money (authoritative total in euros)
      totals: { total: totalEuros },
    };

    const created = await createOrReusePendingBooking(dto);
    return NextResponse.json({ ok: true, bookingId: created.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
