import type { MetadataRoute } from "next";

/**
 * Sitemap strategy:
 * - Production: absolute URLs using NEXT_PUBLIC_SITE_URL.
 * - Non-prod: still returns a valid sitemap (helps for local tooling),
 *   but ensure robots.ts blocks indexing on staging/preview.
 *
 * ENV:
 * - NEXT_PUBLIC_SITE_URL: e.g., "https://amr.pt" (no trailing slash).
 * - NEXT_PUBLIC_ENV: "production" | "staging" | "development" | "preview" (optional; informational here).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    "https://example.com";

  // Helper to build absolute URLs consistently
  const u = (path: string) =>
    `${site}${path.startsWith("/") ? "" : "/"}${path}`;

  // Known static routes (expand as we add)
  const staticRoutes = [
    { path: "/", priority: 1.0, changefreq: "daily" as const },
    { path: "/catalog", priority: 0.9, changefreq: "daily" as const },
    { path: "/legal/terms", priority: 0.2, changefreq: "yearly" as const },
    { path: "/legal/privacy", priority: 0.2, changefreq: "yearly" as const },
    { path: "/legal/cookies", priority: 0.2, changefreq: "yearly" as const },
  ];

  /**
   * Dynamic machine detail pages:
   * We’ll wire these in Step 1c once you confirm the detail route pattern,
   * e.g., /machines/[slug] or /catalog/[slug].
   * For now we return the static base; robots already protects non-prod.
   */
  // const machineEntries: MetadataRoute.Sitemap = await getMachineSitemapEntries();

  const now = new Date().toISOString();

  const entries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: u(r.path),
    lastModified: now,
    changeFrequency: r.changefreq,
    priority: r.priority,
  }));

  // return [...entries, ...machineEntries];
  return entries;
}
