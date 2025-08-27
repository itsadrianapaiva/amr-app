import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAllDayEvent } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/_debug/calendar-smoke?key=...&start=YYYY-MM-DD&end=YYYY-MM-DD&summary=...&description=...
 * Requirements:
 * - key must match process.env.SMOKE_TEST_KEY (to prevent public abuse).
 * Defaults:
 * - start = tomorrow in server time
 * - end = start + 1 day (so it blocks 2 inclusive days)
 * - summary = "AMR Smoke Test"
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expectKey = process.env.SMOKE_TEST_KEY;

  if (!expectKey) {
    return NextResponse.json(
      { ok: false, error: "Server not configured: missing SMOKE_TEST_KEY" },
      { status: 500 }
    );
  }
  if (key !== expectKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Parse inputs with safe defaults
  const today = new Date();
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const summary = url.searchParams.get("summary") || "AMR Smoke Test";
  const description =
    url.searchParams.get("description") ||
    "This is a temporary verification event created by the smoke-test route.";

  const start = startParam ? new Date(startParam) : addDays(today, 1);
  const end = endParam ? new Date(endParam) : addDays(start, 1);

  // Normalize to YYYY-MM-DD for our helper (inclusive range)
  const startYmd = format(start, "yyyy-MM-dd");
  const endYmd = format(end, "yyyy-MM-dd");

  try {
    const eventId = await createAllDayEvent({
      summary,
      description,
      startDate: startYmd,
      endDate: endYmd,
    });

    return NextResponse.json({
      ok: true,
      eventId,
      startDate: startYmd,
      endDate: endYmd,
      hint: "Check the AMR Rentals calendar for a 2-day all-day event.",
    });
  } catch (err: unknown) {
    const anyErr = err as any;
    return NextResponse.json(
      { ok: false, error: anyErr?.message || "Unknown calendar error" },
      { status: 500 }
    );
  }
}
