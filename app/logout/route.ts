import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

/**
 * GET /logout
 * - Clears the ops session cookie.
 * - Redirects to /login, preserving an optional ?next= path.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next");
  // Only allow same-origin paths for safety.
  const loginTarget =
    nextParam && nextParam.startsWith("/")
      ? `/login?next=${encodeURIComponent(nextParam)}`
      : "/login";

  const res = NextResponse.redirect(new URL(loginTarget, url.origin));
  // Clear the cookie using our unified helper (HttpOnly, SameSite, Secure-in-prod).
  res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
}
