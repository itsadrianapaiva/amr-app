import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeInvoicePdfLink, makeInvoicePdfLinkForEnv } from "@/lib/invoicing/invoice-links";
import { verifySignedToken, secondsUntilExpiry } from "@/lib/security/signed-links";

function getTokenFromUrl(href: string): string {
  const url = new URL(href);
  const t = url.searchParams.get("t");
  if (!t) throw new Error("Missing token param 't'");
  return t;
}

const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef"; // >= 24 chars

beforeEach(() => {
  vi.stubEnv("INVOICING_LINK_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("invoice link helper", () => {
  it("creates a URL whose token decodes to the correct booking id", () => {
    const bookingId = 123;
    const href = makeInvoicePdfLink("https://amr.test", bookingId, { ttlSeconds: 3600 });

    // Shape check
    const u = new URL(href);
    expect(u.origin).toBe("https://amr.test");
    expect(u.pathname).toBe("/api/invoices/123/pdf");

    // Token decode check
    const token = getTokenFromUrl(href);
    const payload = verifySignedToken<{ bid: number }>(token);
    expect(payload).toBeTruthy();
    expect(payload && (payload as any).bid).toBe(bookingId);

    const ttl = secondsUntilExpiry(token);
    expect(ttl && ttl > 0).toBe(true);
  });

  it("resolves base URL from env and enforces https in production", () => {
    // Simulate production with http base to verify https enforcement
    vi.stubEnv("APP_URL", "http://site.test");
    vi.stubEnv("NODE_ENV", "production");

    const href = makeInvoicePdfLinkForEnv(45, { ttlSeconds: 60 });

    const u = new URL(href);
    expect(u.protocol).toBe("https:");
    expect(u.host).toBe("site.test");
    expect(u.pathname).toBe("/api/invoices/45/pdf");

    const token = getTokenFromUrl(href);
    const payload = verifySignedToken<{ bid: number }>(token);
    expect(payload && (payload as any).bid).toBe(45);
  });
});
