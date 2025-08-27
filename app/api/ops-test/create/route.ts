// app/api/ops-test/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createManagerBooking } from "@/app/ops/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ops-test/create
 * Required:
 *   - key=<OPS_PASSCODE>
 *   - machineId=1
 *   - start=YYYY-MM-DD
 *   - end=YYYY-MM-DD
 *
 * Optional toggles (1|true):
 *   - delivery=1&pickup=1&insurance=1&operator=1
 *
 * Optional customer (defaults for quick testing):
 *   - customerName=...&customerEmail=...&customerPhone=...&customerNIF=...
 *   - totalCost=0
 *
 * Optional site address (object fields; we also accept legacy siteAddress -> line1):
 *   - siteLine1=...   (alias: siteAddress)
 *   - sitePostal=...
 *   - siteCity=...
 *   - siteNotes=...
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  // Passcode auth
  const key = p.get("key") || "";
  const expected = process.env.OPS_PASSCODE || "";
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Server missing OPS_PASSCODE" },
      { status: 500 }
    );
  }
  if (key !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Required params
  const machineId = Number(p.get("machineId"));
  const start = p.get("start") || "";
  const end = p.get("end") || "";

  // Optional toggles
  const asBool = (v: string | null) => v === "1" || v === "true";
  const delivery = asBool(p.get("delivery"));
  const pickup = asBool(p.get("pickup"));
  const insurance = asBool(p.get("insurance"));
  const operator = asBool(p.get("operator"));

  // Optional customer
  const customerName = p.get("customerName") || "OPS Booking";
  const customerEmail = p.get("customerEmail") || "ops@example.com";
  const customerPhone = p.get("customerPhone") || "000000000";
  const customerNIF = p.get("customerNIF") || undefined;

  // Optional totals
  const totalCostRaw = p.get("totalCost");
  const totalCost = Number.isFinite(Number(totalCostRaw)) ? Number(totalCostRaw) : 0;

  // Optional address — build object only if at least one field is present
  const line1 = p.get("siteLine1") ?? p.get("siteAddress") ?? undefined; // legacy alias supported
  const postalCode = p.get("sitePostal") ?? undefined;
  const city = p.get("siteCity") ?? undefined;
  const notes = p.get("siteNotes") ?? undefined;

  const siteAddress =
    line1 || postalCode || city || notes
      ? { line1, postalCode, city, notes }
      : undefined;

  try {
    const result = await createManagerBooking({
      passcode: key,
      machineId,
      managerName: "Ops Test",
      startDate: start, // YYYY-MM-DD
      endDate: end,     // YYYY-MM-DD
      delivery,
      pickup,
      insurance,
      operator,
      customerName,
      customerEmail,
      customerPhone,
      customerNIF,
      totalCost,
      siteAddress,
    });

    // Don't duplicate `ok`; just return the action's shape.
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: unknown) {
    const anyErr = err as any;
    return NextResponse.json(
      { ok: false, error: anyErr?.message || "Unknown error" },
      { status: 400 }
    );
  }
}
