import { describe, it, expect, vi, afterEach } from "vitest";
import { makeInvoicePdfLinkForEnv } from "@/lib/invoicing/invoice-links";

describe("invoice-links: base URL resolution", () => {
  // Clean up any env stubs so tests don't bleed into each other
  afterEach(() => vi.unstubAllEnvs());

  it("expands $deploy_prime_url placeholder and enforces https", () => {
    // Netlify branch deploy exposes DEPLOY_PRIME_URL as full origin
    vi.stubEnv(
      "DEPLOY_PRIME_URL",
      "http://staging--algarvemachinery.netlify.app"
    );

    // Reproduce the real-world misconfig you saw in emails
    // Ensure we actually hit the placeholder branch in the resolver
    vi.stubEnv("APP_URL", "http://$deploy_prime_url");

    // Build a signed link for a concrete booking id
    const url = makeInvoicePdfLinkForEnv(332);

    // 1) Placeholder is expanded to the Netlify URL
    // 2) Scheme is normalized to https for non-local hosts
    // 3) Path is the proxy endpoint with a token query
    expect(url).toMatch(
      /^https:\/\/staging--algarvemachinery\.netlify\.app\/api\/invoices\/332\/pdf\?t=/
    );

    // No literal "$deploy_prime_url" should remain
    expect(url).not.toContain("$deploy_prime_url");
  });

  it("prefers APP_URL over NEXT_PUBLIC_APP_URL/URL/DEPLOY_* when valid", () => {
    vi.stubEnv("APP_URL", "https://amr.example.com");
    vi.stubEnv(
      "DEPLOY_PRIME_URL",
      "http://staging--algarvemachinery.netlify.app"
    );

    const url = makeInvoicePdfLinkForEnv(7);
    expect(url).toMatch(
      /^https:\/\/amr\.example\.com\/api\/invoices\/7\/pdf\?t=/
    );
  });
});
