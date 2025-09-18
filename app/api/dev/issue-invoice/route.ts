import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maybeIssueInvoice } from "@/lib/invoicing/issue-for-booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    // This route relies on your global middleware gate (x-e2e-secret).
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));
    const piParam = url.searchParams.get("pi") || undefined; // optional PI override

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid ?id" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Pull booking facts from DB
    const b = await db.booking.findUnique({
      where: { id },
      include: { machine: true },
    });

    if (!b) {
      return NextResponse.json(
        { ok: false, error: "Booking not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Build the minimal facts our orchestrator needs
    const facts = {
      id: b.id,
      startDate: b.startDate,
      endDate: b.endDate,
      machineName: b.machine.name,
      // unit price must be net/ex-VAT in integer cents
      unitDailyCents: Math.round(Number(b.machine.dailyRate) * 100),
      vatPercent: 23,
      customerName: b.customerName,
      customerEmail: b.customerEmail || undefined,
      customerNIF: b.customerNIF || undefined,
      billing: b.billingAddressLine1
        ? {
            line1: b.billingAddressLine1 || "",
            city: b.billingCity || "",
            postalCode: b.billingPostalCode || "",
            country: (b.billingCountry as "PT") || "PT",
          }
        : undefined,
    } as const;

    // Choose a PI: explicit ?pi param, or stored on the booking if present
    const paymentIntentId = piParam || b.stripePaymentIntentId || "";
    if (!paymentIntentId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing pi; pass ?pi=pi_xxx or persist stripePaymentIntentId on Booking",
        },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Helpful early toggle to make misconfig obvious
    if (process.env.INVOICING_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, error: "INVOICING_DISABLED. Set INVOICING_ENABLED=true" },
        { status: 412, headers: { "cache-control": "no-store" } }
      );
    }

    // Issue the invoice (returns null only if internally disabled by provider)
    const record = await maybeIssueInvoice({
      booking: facts,
      stripePaymentIntentId: paymentIntentId,
      paidAt: new Date(),
      notes: `AMR booking #${b.id}`,
    });

    if (!record) {
      return NextResponse.json(
        {
          ok: false,
          error: "Provider declined issuance (disabled or misconfigured)",
        },
        { status: 409, headers: { "cache-control": "no-store" } }
      );
    }

    // Persist back to Booking for quick visibility in Ops/UI
    await db.booking.update({
      where: { id: b.id },
      data: {
        invoiceProvider: record.provider,
        invoiceProviderId: record.providerInvoiceId,
        invoiceNumber: record.number,
        invoicePdfUrl: record.pdfUrl,
        invoiceAtcud: record.atcud || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { ok: true, record },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const stack =
      process.env.DEBUG_INVOICING === "1" && err instanceof Error
        ? err.stack
        : undefined;

    console.error("[dev/issue-invoice] Error:", msg, stack);
    return NextResponse.json(
      { ok: false, error: msg, stack },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
