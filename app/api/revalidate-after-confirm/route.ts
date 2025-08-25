// Revalidate catalog and (optionally) a machine page after a booking is confirmed.
// Called by our success page *after* DB promotion.

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

// Keep on Node runtime (and dynamic) so revalidatePath is allowed here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1) Parse JSON body leniently; default to an empty object if none.
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // 2) Always revalidate the catalog; optionally revalidate a machine page.
  const revalidated = new Set<string>(["/"]);
  const machineId = Number(body?.machineId);
  if (Number.isFinite(machineId)) {
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
