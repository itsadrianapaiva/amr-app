// Revalidate catalog and (optionally) a machine page after a booking is confirmed.
// Called by our success page *after* DB promotion.

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

// Keep on Node runtime (and dynamic) so revalidatePath is allowed here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Narrow unknown JSON to a loose body shape we accept. */
type Body = { machineId?: number | string | null };

/** True if value is a non-null object (record-like). */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Read a finite number from unknown (accepts number|string). */
function readFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  // 1) Parse JSON body safely; default to empty object on failure.
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    raw = null;
  }
  const body: Body = isRecord(raw) ? (raw as Body) : {};

  // 2) Always revalidate the catalog; optionally revalidate a machine page.
  const revalidated = new Set<string>(["/"]);

  const machineId = readFiniteNumber(body.machineId);
  if (machineId !== null) {
    revalidated.add(`/machine/${machineId}`);
  }

  // 3) Execute revalidations (outside of render, which Next requires).
  for (const p of revalidated) {
    revalidatePath(p);
  }

  // 4) Return a tiny JSON payload for observability.
  return new Response(
    JSON.stringify({ ok: true, revalidated: Array.from(revalidated) }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
