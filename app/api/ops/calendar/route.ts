// app/api/ops/calendar/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addBookingToCalendar } from "@/lib/server/ops-calendar";

// Ensure this runs on Node (not edge) and never caches.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Uniform headers for every response.
function jsonHeaders(traceId: string) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "x-trace-id": traceId,
  };
}

// POST /api/ops/calendar
export async function POST(req: Request) {
  const traceId = randomUUID();

  let payload: any;
  try {
    // Read the body exactly once. If this throws, respond with shaped JSON.
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, formError: "Invalid JSON body", traceId },
      { status: 200, headers: jsonHeaders(traceId) }
    );
  }

  try {
    // Hand off to the server helper with its own Zod validation.
    const result = await addBookingToCalendar(payload);

    // Helper contract:
    //  - success: { ok: true, eventId, htmlLink? }
    //  - error:   { ok: false, formError }
    if (result?.ok === true) {
      return NextResponse.json(
        {
          ok: true,
          eventId: result.eventId,
          htmlLink: result.htmlLink,
          traceId,
        },
        { status: 200, headers: jsonHeaders(traceId) }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        formError: String(result?.formError || "Calendar error"),
        traceId,
      },
      { status: 200, headers: jsonHeaders(traceId) }
    );
  } catch (err: unknown) {
    // Last-resort guard: never throw to the network.
    const msg =
      (err as any)?.message ||
      (typeof err === "string" ? err : "Internal calendar error");
    return NextResponse.json(
      { ok: false, formError: msg, traceId },
      { status: 200, headers: jsonHeaders(traceId) }
    );
  }
}
