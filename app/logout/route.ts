// app/logout/route.ts
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

/**
 * GET /logout
 * - Clears the ops session cookie.
 * - Redirects to /login, preserving an optional ?next= path.
 * - IMPORTANT: emits a *relative* Location to avoid cross-origin on Netlify RSC/data hosts.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next");

  // Only allow same-origin paths for safety.
  const loginTarget =
    nextParam && nextParam.startsWith("/")
      ? `/login?next=${encodeURIComponent(nextParam)}`
      : "/login";

  // Build a manual redirect response with a RELATIVE Location.
  // We avoid NextResponse.redirect(new URL(...)) because that serializes as absolute and
  // can point at Netlify's deploy-hash host during RSC requests (cross-origin).
  const res = new NextResponse(null, {
    status: 307,
    headers: {
      location: loginTarget,            // <-- relative path, stays same-origin in the browser
      "cache-control": "no-store",
    },
  });

  // Clear the cookie using our unified helper (HttpOnly, SameSite, Secure-in-prod).
  res.headers.append("Set-Cookie", clearSessionCookie());

  return res;
}
