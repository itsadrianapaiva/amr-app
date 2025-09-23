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

/** Detect if URL is Vendus and return a *fetchable* URL with proper params applied. */
function prepareVendusUrl(raw: string): string {
  const u = new URL(raw);
  const host = u.hostname.toLowerCase();
  const isVendus = host === "www.vendus.pt" || host.endsWith(".vendus.pt");
  if (!isVendus) return raw;

  // Ensure correct working mode for detail/pdf GETs:
  // Vendus requires `mode` to match how the doc was created (normal|tests).
  const mode = (process.env.VENDUS_MODE || "").toLowerCase();
  if (mode === "tests" || mode === "normal") {
    if (!u.searchParams.has("mode")) u.searchParams.set("mode", mode);
  }

  // Optional escape hatch: some setups prefer query auth. Leave off by default.
  if (process.env.VENDUS_FORCE_QUERY_AUTH === "1") {
    const key = (process.env.VENDUS_API_KEY || "").trim();
    if (key) u.searchParams.set("api_key", key);
  }

  return u.toString();
}

/** Vendus auth headers: HTTP Basic with API key as user and EMPTY password. */
function vendusAuthHeadersFor(urlStr: string): HeadersInit | undefined {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const isVendus = host === "www.vendus.pt" || host.endsWith(".vendus.pt");
    if (!isVendus) return undefined;

    const apiKey = (process.env.VENDUS_API_KEY || "").trim();
    const basicFixed = (process.env.VENDUS_AUTH_BASIC || "").trim();
    const bearer = (process.env.VENDUS_BEARER_TOKEN || "").trim();

    let Authorization: string | undefined;

    if (apiKey) {
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

    // Prepare upstream URL (adds mode/tests when needed) and headers.
    const upstreamUrl = prepareVendusUrl(booking.invoicePdfUrl);
    const authHeaders = vendusAuthHeadersFor(upstreamUrl);

    const upstream = await fetch(upstreamUrl, {
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
