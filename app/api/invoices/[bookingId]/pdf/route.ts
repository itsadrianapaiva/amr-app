import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySignedToken } from "@/lib/security/signed-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TokenPayload = { bid: number }; // minimal payload for MVP

function safeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
}

/** Detects if the upstream PDF lives on Vendus and, if so, attaches auth headers. */
function vendusAuthHeadersFor(urlStr: string): HeadersInit | undefined {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const isVendus = host === "www.vendus.pt" || host.endsWith(".vendus.pt");
    if (!isVendus) return undefined;

    // Vendus v1.1 auth: HTTP Basic with API key as username and EMPTY password.
    // Ref: docs show curl -u api_key: https://.../account (empty password).
    // No secret required. :contentReference[oaicite:1]{index=1}
    const apiKey = (process.env.VENDUS_API_KEY || "").trim();

    // Optional fallbacks if you ever pre-bake an Authorization value or switch modes.
    const basicFixed = (process.env.VENDUS_AUTH_BASIC || "").trim(); // "Basic abcd=="
    const bearer = (process.env.VENDUS_BEARER_TOKEN || "").trim(); // "Bearer ey..."

    let Authorization: string | undefined;

    if (apiKey) {
      // Build "Basic base64(apiKey:)" — note the trailing colon.
      const raw = Buffer.from(`${apiKey}:`).toString("base64");
      Authorization = `Basic ${raw}`;
    } else if (basicFixed) {
      Authorization = basicFixed.startsWith("Basic ")
        ? basicFixed
        : `Basic ${basicFixed}`;
    } else if (bearer) {
      Authorization = bearer.startsWith("Bearer ")
        ? bearer
        : `Bearer ${bearer}`;
    }

    return Authorization
      ? { accept: "application/pdf", authorization: Authorization }
      : { accept: "application/pdf" };
  } catch {
    return undefined;
  }
}

export async function GET(
  req: Request,
  ctx: { params: { bookingId: string } }
) {
  try {
    const id = Number(ctx.params.bookingId);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { ok: false, error: "Invalid bookingId" },
        { status: 400, headers: noStore() }
      );
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("t") || "";
    const payload = verifySignedToken<TokenPayload>(token);
    if (!payload || payload.bid !== id) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token" },
        { status: 403, headers: noStore() }
      );
    }

    const booking = await db.booking.findUnique({
      where: { id },
      select: { invoicePdfUrl: true, invoiceNumber: true },
    });

    if (!booking || !booking.invoicePdfUrl) {
      return NextResponse.json(
        { ok: false, error: "Invoice PDF not available" },
        { status: 404, headers: noStore() }
      );
    }

    // Build upstream headers. If Vendus, attach Authorization when possible.
    const authHeaders = vendusAuthHeadersFor(booking.invoicePdfUrl);
    const upstream = await fetch(booking.invoicePdfUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "application/pdf",
        ...(authHeaders || {}),
      },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const preview = await safePreview(upstream);
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch invoice PDF from provider",
          status: upstream.status,
          preview,
        },
        { status: 502, headers: noStore() }
      );
    }

    const fileName =
      (booking.invoiceNumber && safeFilename(`${booking.invoiceNumber}.pdf`)) ||
      `booking-${id}.pdf`;

    return new NextResponse(upstream.body as any, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "cache-control": "private, no-store",
        "content-disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unexpected server error" },
      { status: 500, headers: noStore() }
    );
  }
}

function noStore(): Record<string, string> {
  return { "cache-control": "no-store, max-age=0" };
}

async function safePreview(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/pdf")) return "pdf";
    const text = await res.text();
    return text.slice(0, 200);
  } catch {
    return "";
  }
}
