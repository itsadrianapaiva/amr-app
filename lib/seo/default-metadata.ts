import type { Metadata } from "next";

/**
 * Creates a production-safe default Metadata object for Next.js App Router.
 * - Uses NEXT_PUBLIC_SITE_URL as metadataBase/canonical origin.
 * - Title template: "AMR Machinery • %s"
 * - Defaults are minimal and brand-safe; per-page overrides remain easy.
 */
export function createDefaultMetadata(): Metadata {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://example.com";

  // metadataBase guides canonical URLs and OG absolute URLs
  const metadataBase = new URL(site);

  const title = {
    default: "AMR Machinery — Instant Online Rental",
    template: "AMR Machinery • %s",
  };

  const description =
    "Rent construction machinery online in minutes. Instant booking, clear pricing with VAT, and fast pickup or delivery across the Algarve.";

  return {
    metadataBase,
    title,
    description,

    // Canonical for the root; pages can override via alternates.canonical
    alternates: {
      canonical: "/",
    },

    // Open Graph defaults: share-friendly cards
    openGraph: {
      type: "website",
      url: "/",
      title: title.default,
      description,
      siteName: "AMR Machinery",
      images: [
        {
          url: "/og/cover.png",
          width: 1200,
          height: 630,
          alt: "AMR Machinery — Instant Online Rental",
        },
      ],
      locale: "en_PT",
    },

    // Twitter card (works for X as well)
    twitter: {
      card: "summary_large_image",
      site: "@amr_machinery",
      title: title.default,
      description,
      images: ["/og/cover.png"],
    },

    // Favicons and manifest: we’ll add files in the next substep
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },

    // Basic robots meta (complements app/robots.ts)
    robots: {
      index: (process.env.NEXT_PUBLIC_ENV || "").toLowerCase() === "production",
      follow: (process.env.NEXT_PUBLIC_ENV || "").toLowerCase() === "production",
      nocache: false,
    },

    // App name (nice-to-have for some UAs)
    applicationName: "AMR Machinery",
    generator: "Next.js",
    category: "Construction",
  };
}
