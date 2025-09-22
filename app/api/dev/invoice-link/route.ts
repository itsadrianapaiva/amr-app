import { NextRequest, NextResponse } from "next/server";
import { makeInvoicePdfLinkForEnv } from "@/lib/invoicing/invoice-links";

/**
 * GET /api/dev/invoice-link?bookingId=123&ttl=3600
 * Headers: x-e2e-secret: <E2E_SECRET>
 *
 * Returns: { ok: true, url: "https://.../api/invoices/123/pdf?t=..." }
 * Notes:
 * - Guarded by x-e2e-secret, safe to deploy to staging/prod (secret must match).
 * - Uses the same resolver as emails, so it also exercises the $deploy_prime_url fix.
 */
export async function GET(req: NextRequest) {
  // --- Guard: only allow test clients that know the shared secret
  const secretHeader = req.headers.get("x-e2e-secret") || "";
  const expected = process.env.E2E_SECRET || "";
  if (!expected || secretHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  // --- Parse query params
  const { searchParams } = new URL(req.url);
  const bookingIdRaw = searchParams.get("bookingId");
  const ttlRaw = searchParams.get("ttl");

  const bookingId = Number(bookingIdRaw);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid bookingId" },
      { status: 400 }
    );
  }

  const ttlSeconds =
    ttlRaw !== null && ttlRaw !== "" ? Number(ttlRaw) : undefined;
  if (
    ttlSeconds !== undefined &&
    (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid ttl (seconds)" },
      { status: 400 }
    );
  }

  try {
    // --- Build via centralized resolver (expands $deploy_prime_url, enforces https)
    const url = makeInvoicePdfLinkForEnv(bookingId, { ttlSeconds });

    // --- Return deterministic JSON for the test to consume
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
