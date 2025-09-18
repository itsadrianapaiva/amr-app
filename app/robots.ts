import type { MetadataRoute } from "next";

/**
 * Robots policy:
 * - Production: allow indexing and expose sitemap.
 * - Non-production (staging/feature/deploy previews): disallow all and hide sitemap.
 *
 * ENV knobs (sensible defaults so we don't need to touch code later):
 * - NEXT_PUBLIC_ENV: "production" | "staging" | "development" | "preview"
 * - NEXT_PUBLIC_SITE_URL: e.g., "https://amr.pt" (no trailing slash)
 * - NEXT_PUBLIC_ROBOTS_ALLOW: optional hard override "true"/"false" (string)
 */
export default function robots(): MetadataRoute.Robots {
  const env = (process.env.NEXT_PUBLIC_ENV || "").toLowerCase();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://example.com";

  // Optional override switch: if explicitly set, it wins.
  const override = process.env.NEXT_PUBLIC_ROBOTS_ALLOW?.toLowerCase();
  const isOverrideOn = override === "true";
  const isOverrideOff = override === "false";

  // Default policy by environment
  const isProd = env === "production";
  const allowIndex = isOverrideOn ? true : isOverrideOff ? false : isProd;

  if (!allowIndex) {
    // Safe default for non-prod: block everything, no sitemap leak
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
      sitemap: [],
    };
  }

  // Production: allow everything except explicit internal/dev paths if any
  const sitemaps: string[] = [`${site}/sitemap.xml`];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: sitemaps,
    host: site,
  };
}
