export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { addBookingToCalendar } from "@/lib/server/ops-calendar";

/**
 * POST /api/ops/calendar
 * Body: {
 *   bookingId, machineId, startYmd, endYmd, managerName,
 *   customerName?, siteAddressLine1?, siteAddressCity?, siteAddressNotes?
 * }
 * Returns: { ok: true, eventId, htmlLink? } | { ok: false, formError }
 */
export async function POST(req: Request) {
  // 1) Parse JSON body safely
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, formError: "Invalid JSON body" }, { status: 400 });
  }

  // 2) Delegate to server-only helper (handles validation and errors)
  const result = await addBookingToCalendar(body);

  // 3) Map helper result to HTTP status (200 on success, 400 on user error)
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}

// Optional: quick guard for other methods
export async function GET() {
  return NextResponse.json({ ok: false, formError: "Method not allowed" }, { status: 405 });
}
