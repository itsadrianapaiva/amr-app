import { NextResponse, NextRequest } from "next/server";
import { addDays, format } from "date-fns";
import { createAllDayEvent } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calendar-smoke?key=...&start=YYYY-MM-DD&end=YYYY-MM-DD&summary=...&description=...
 * - If SMOKE_TEST_KEY is set, key must match; if SMOKE_TEST_KEY is empty, route is open (dev-friendly).
 * - Defaults: start = tomorrow, end = start + 1 day (2 inclusive days).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const providedKey = params.get("key");
  const expectedKey = process.env.SMOKE_TEST_KEY; // optional

  if (expectedKey && providedKey !== expectedKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Defaults: tomorrow through the day after (inclusive 2 days)
  const today = new Date();
  const startParam = params.get("start");
  const endParam = params.get("end");
  const summary = params.get("summary") || "AMR Smoke Test";
  const description =
    params.get("description") ||
    "Temporary verification event created by the smoke-test route.";

  const start = startParam ? new Date(startParam) : addDays(today, 1);
  const end = endParam ? new Date(endParam) : addDays(start, 1);

  const startYmd = format(start, "yyyy-MM-dd");
  const endYmd = format(end, "yyyy-MM-dd");

  try {
    const eventId = await createAllDayEvent({
      summary,
      description,
      startDate: startYmd,
      endDate: endYmd,
    });
    return NextResponse.json({ ok: true, eventId, startDate: startYmd, endDate: endYmd });
  } catch (err: unknown) {
    const anyErr = err as any;
    return NextResponse.json(
      { ok: false, error: anyErr?.message || "Unknown calendar error" },
      { status: 500 }
    );
  }
}
