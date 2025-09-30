import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
// wrap chrome that we want to hide on certain routes (e.g., success)
import LayoutChrome from "@/components/layout-chrome";
import ConsentProvider from "@/components/consent-provider";
import { getFooterCategories } from "@/lib/data/footer-categories";
import { createDefaultMetadata } from "@/lib/seo/default-metadata";
import OrganizationJsonLd from "@/components/seo/organization-jsonld";
import { unstable_cache } from "next/cache";

/**
 * We compose brand-safe defaults (canonical, OG/Twitter, robots) from
 * createDefaultMetadata(), then override title/description and wire your icons
 * that already live in /app: favicon.ico, apple-icon.png, icon0.svg, icon1.png.
 */
export const metadata: Metadata = {
  ...createDefaultMetadata(),
  title: {
    default: "AMR — Machinery Rentals in the Algarve",
    template: "AMR • %s",
  },
  description: "Instant online booking for pro-grade machinery.",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon1.png", type: "image/png", sizes: "512x512" },
      { url: "/icon0.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

// Env-aware flags so we only warm connections we actually use.
const hasGA =
  !!process.env.NEXT_PUBLIC_GA4_ID || !!process.env.NEXT_PUBLIC_GADS_ID;
const hasStripe = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** Cache footer categories to reduce server work on every route. */
const getFooterCategoriesCached = unstable_cache(
  async () => getFooterCategories(),
  ["footer-categories"],
  { revalidate: 3600 }
);

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const footerCategories = await getFooterCategoriesCached();

  return (
    <html lang="en">
      <head>
        {/* Connection warmups */}
        {hasGA && (
          <>
            <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
            <link
              rel="preconnect"
              href="https://www.googletagmanager.com"
              crossOrigin=""
            />
            <link rel="dns-prefetch" href="https://www.google-analytics.com" />
            <link
              rel="preconnect"
              href="https://www.google-analytics.com"
              crossOrigin=""
            />
          </>
        )}
        {hasStripe && (
          <>
            <link rel="dns-prefetch" href="https://js.stripe.com" />
            <link
              rel="preconnect"
              href="https://js.stripe.com"
              crossOrigin=""
            />
            <link rel="dns-prefetch" href="https://m.stripe.com" />
            <link rel="preconnect" href="https://m.stripe.com" crossOrigin="" />
          </>
        )}
      </head>
      <body>
        {/* GA + Consent Mode boot (loads gtag and applies consent) */}
        <ConsentProvider />

        {/* SEO JSON-LD */}
        <OrganizationJsonLd />

        {/* Invisible anchor so '/#home' targets the very top */}
        <div id="home" className="sr-only" aria-hidden="true" />
        {/* Sticky header on all pages */}
        <SiteNav />

        {/* Page content */}
        {children}

        {/* Global footer on all pages */}
        <SiteFooter categories={footerCategories} />

        {/* Centralized chrome (WhatsApp + Cookie banner), hidden on /booking/success */}
        <LayoutChrome />
      </body>
    </html>
  );
}
