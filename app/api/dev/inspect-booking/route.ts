import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
// Always hit the server (no static caching)
export const dynamic = "force-dynamic";
// And do not revalidate
export const revalidate = 0;

export async function GET(req: Request) {

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid ?id" },
      {
        status: 400,
        headers: { "cache-control": "no-store, max-age=0" },
      }
    );
  }

  const row = await db.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      depositPaid: true,
      stripePaymentIntentId: true,
      holdExpiresAt: true,
    },
  });

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404, headers: { "cache-control": "no-store, max-age=0" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: row.id,
      status: row.status,
      depositPaid: row.depositPaid,
      stripePaymentIntentId: row.stripePaymentIntentId,
      holdExpiresAt: row.holdExpiresAt,
    },
    {
      headers: { "cache-control": "no-store, max-age=0" },
    }
  );
}
