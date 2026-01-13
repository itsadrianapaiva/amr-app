import "server-only";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Small helper to call Vendus with Basic Auth using your API key
async function vendusGet(
  path: string,
  params?: Record<string, string | number | undefined>
) {
  const host = process.env.VENDUS_HOST || "https://www.vendus.pt";
  const url = new URL(`/ws${path}`, host);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const key = process.env.VENDUS_API_KEY || "";
  const auth = Buffer.from(`${key}:`).toString("base64");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
    // defensive: never cache
    next: { revalidate: 0 },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // some Vendus responses aren't JSON; return raw
    json = { raw: text };
  }
  return { status: res.status, json, url: url.toString() };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // vendus registers list probe
    if (url.searchParams.get("vendus") === "registers") {
      const out = await vendusGet("/v1.0/registers/");
      return NextResponse.json(
        { ok: out.status === 200, stage: "vendus-registers", result: out.json },
        { headers: { "cache-control": "no-store" }, status: out.status }
      );
    }

    // vendus register detail probe
    if (url.searchParams.get("vendus")?.startsWith("register:")) {
      const idStr = url.searchParams.get("vendus")!.split(":")[1];
      const id = Number(idStr);
      const { getRegisterDetail } = await import(
        "@/lib/invoicing/vendors/vendus/registers"
      );
      if (!Number.isFinite(id)) {
        return NextResponse.json(
          { ok: false, error: "Invalid register id" },
          { status: 400 }
        );
      }
      const detail = await getRegisterDetail(id);
      return NextResponse.json(
        { ok: true, stage: "vendus-register-detail", id, detail },
        { headers: { "cache-control": "no-store" } }
      );
    }
    // ---- end vendus debug branch

    // Fast liveness probe
    if (url.searchParams.get("debug") === "1") {
      return NextResponse.json(
        {
          ok: true,
          stage: "entered-handler",
          env: {
            invoicingEnabled: process.env.INVOICING_ENABLED === "true",
            vendusMode: process.env.VENDUS_MODE || null,
            nodeEnv: process.env.NODE_ENV || null,
          },
        },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // robust id parsing; don't treat missing ?id as 0
    const idParam = url.searchParams.get("id");
    const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : NaN;
    const piParam = url.searchParams.get("pi") || undefined;

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid ?id" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Optional per-call doc override: ?doc=PF|FR|FT
    const docParam = url.searchParams.get("doc");
    if (docParam) {
      const allowed = new Set(["PF", "FR", "FT"]);
      if (!allowed.has(docParam)) {
        return NextResponse.json(
          { ok: false, error: "Invalid ?doc. Allowed: PF, FR, FT" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      // Important: set before dynamic imports so vendus core reads it at module eval time.
      process.env.VENDUS_DOC_TYPE = docParam;
    }

    // Lazy-load to keep module-eval errors catchable
    const [{ db }, { maybeIssueInvoice }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/invoicing/issue-for-booking"),
    ]);

    const b = await db.booking.findUnique({
      where: { id },
      include: {
        machine: true,
        items: {
          include: {
            machine: { select: { name: true } },
          },
        },
      },
    });

    if (!b) {
      return NextResponse.json(
        { ok: false, error: "Booking not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    const facts = {
      id: b.id,
      startDate: b.startDate,
      endDate: b.endDate,
      machineName: b.machine.name,
      unitDailyCents: Math.round(Number(b.machine.dailyRate) * 100), // net cents
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
      // Cart-ready fields
      items: b.items.map((item) => ({
        bookingItemId: item.id,
        machineId: item.machineId,
        name: item.machine?.name || "Unknown Item",
        quantity: item.quantity,
        unitPriceCents: Math.round(Number(item.unitPrice) * 100),
        isPrimary: item.isPrimary,
      })),
      discountPercentage: b.discountPercentage
        ? Number(b.discountPercentage)
        : null,
      originalSubtotalExVatCents: b.originalSubtotalExVatCents ?? null,
      discountedSubtotalExVatCents: b.discountedSubtotalExVatCents ?? null,
    } as const;

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

    if (process.env.INVOICING_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, error: "INVOICING_DISABLED. Set INVOICING_ENABLED=true" },
        { status: 412, headers: { "cache-control": "no-store" } }
      );
    }

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
