import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySignedToken } from "@/lib/security/signed-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TokenPayload = { bid: number }; // minimal payload for MVP

function noStore(): Record<string, string> {
  return { "cache-control": "no-store, max-age=0" };
}

function safeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
}

/** Normalize Vendus base URL, ending at /ws (no trailing slash). */
function vendusBase(): string {
  const raw =
    process.env.VENDUS_BASE_URL ||
    process.env.VENDUS_URL ||
    "https://www.vendus.pt/ws";
  return raw.replace(/\/+$/, "");
}

/** Deterministic direct PDF URL as a last resort. */
function vendusDirectPdfUrl(providerId: string): string {
  return `${vendusBase()}/v1.1/documents/${encodeURIComponent(providerId)}.pdf`;
}

/** Is a URL pointing at Vendus? */
function isVendusUrl(urlStr: string): boolean {
  try {
    const h = new URL(urlStr).hostname.toLowerCase();
    return h === "www.vendus.pt" || h.endsWith(".vendus.pt");
  } catch {
    return false;
  }
}

/** Add mode and optional query auth if the target host is Vendus. */
function prepareVendusUrl(raw: string): string {
  const u = new URL(raw);
  if (!isVendusUrl(raw)) return raw;

  const mode = (process.env.VENDUS_MODE || "").toLowerCase();
  if ((mode === "tests" || mode === "normal") && !u.searchParams.has("mode")) {
    u.searchParams.set("mode", mode);
  }
  if (process.env.VENDUS_FORCE_QUERY_AUTH === "1") {
    const key = (process.env.VENDUS_API_KEY || "").trim();
    if (key) u.searchParams.set("api_key", key);
  }
  return u.toString();
}

/** Vendus auth headers: HTTP Basic with API key as username and EMPTY password. */
function vendusAuthHeadersFor(urlStr: string): HeadersInit | undefined {
  try {
    if (!isVendusUrl(urlStr)) return undefined;
    const apiKey = (process.env.VENDUS_API_KEY || "").trim();
    if (!apiKey) return { accept: "application/pdf" };
    const basic = Buffer.from(`${apiKey}:`).toString("base64");
    return { accept: "application/pdf", authorization: `Basic ${basic}` };
  } catch {
    return undefined;
  }
}

/** True when a response is a PDF stream. */
function isPdfResponse(res: Response): boolean {
  const ct = res.headers.get("content-type") || "";
  return res.ok && res.body != null && ct.includes("application/pdf");
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

/**
 * Try streaming first (with server-side auth), then redirect if needed.
 * This avoids browser login prompts while still giving us an escape hatch.
 */
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
      select: {
        invoiceProvider: true,
        invoiceProviderId: true,
        invoicePdfUrl: true,
        invoiceNumber: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: "Booking not found" },
        { status: 404, headers: noStore() }
      );
    }

    // 1) Choose the candidate URL
    const candidate =
      booking.invoicePdfUrl ||
      (booking.invoiceProvider === "vendus" && booking.invoiceProviderId
        ? vendusDirectPdfUrl(booking.invoiceProviderId)
        : null);

    if (candidate) {
      const upstreamUrl = prepareVendusUrl(candidate);
      const headers = vendusAuthHeadersFor(upstreamUrl);

      // 2) Attempt authenticated streaming (prevents browser auth prompt)
      try {
        const upstream = await fetch(upstreamUrl, {
          method: "GET",
          redirect: "follow",
          headers: {
            accept: "application/pdf",
            ...(headers || {}),
          },
          cache: "no-store",
        });

        if (isPdfResponse(upstream)) {
          const fileName =
            (booking.invoiceNumber &&
              safeFilename(`${booking.invoiceNumber}.pdf`)) ||
            `booking-${id}.pdf`;

          return new NextResponse(upstream.body as any, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "cache-control": "private, no-store",
              "content-disposition": `inline; filename="${fileName}"`,
            },
          });
        }

        // 3) If we didn’t get a PDF (401/403/404, HTML, etc.), fall through to redirect
      } catch {
        // Network/auth error → try redirect next
      }

      // 4) Redirect fallback (may still succeed if .pdf accepts query auth)
      const redir = NextResponse.redirect(upstreamUrl, { status: 302 });
      redir.headers.set("cache-control", "private, no-store");
      redir.headers.set(
        "x-filename-hint",
        (booking.invoiceNumber &&
          safeFilename(`${booking.invoiceNumber}.pdf`)) ||
          `booking-${id}.pdf`
      );
      return redir;
    }

    // No candidate URL at all → diagnostic JSON
    return NextResponse.json(
      {
        ok: false,
        error: "Could not resolve invoice PDF link",
        provider: booking.invoiceProvider || null,
        providerId: booking.invoiceProviderId || null,
        invoiceNumber: booking.invoiceNumber || null,
        hint:
          "No stored PDF URL and no provider id available. Issue the invoice or verify persistence.",
      },
      { status: 502, headers: noStore() }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unexpected server error" },
      { status: 500, headers: noStore() }
    );
  }
}
