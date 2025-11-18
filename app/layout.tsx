import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
// wrap chrome that we want to hide on certain routes (e.g., success)
import LayoutChrome from "@/components/layout-chrome";
import Ga4Pageview from "@/components/analytics/ga4-pageview";
import FacebookPixel from "@/components/analytics/facebook-pixel";
import { getFooterCategories } from "@/lib/data/footer-categories";
import { createDefaultMetadata } from "@/lib/seo/default-metadata";
import OrganizationJsonLd from "@/components/seo/organization-jsonld";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import Script from "next/script";

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
  const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

  return (
    <html lang="en">
      <head>
        <FacebookPixel />

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

        {/*  Minimal GA4 with Consent Mode default (one-time, no wrappers)  */}
        {GA4_ID && (
          <>
            {/* 1) Create dataLayer + Consent default BEFORE gtag loads */}
            <Script id="ga4-consent-default" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){ dataLayer.push(arguments); }

                // Consent Mode v2: start conservative
                gtag('consent', 'default', {
                  ad_user_data: 'denied',
                  ad_personalization: 'denied',
                  ad_storage: 'denied',
                  analytics_storage: 'denied',
                  functionality_storage: 'granted',
                  security_storage: 'granted'
                });

                // If our cookie says analytics=true, upgrade immediately
                try {
                  var m = document.cookie.match(/(?:^|;\\s*)amr_consent=([^;]+)/);
                  if (m) {
                    var c = JSON.parse(decodeURIComponent(m[1]));
                    if (c && c.analytics) {
                      gtag('consent', 'update', { analytics_storage: 'granted' });
                    }
                    if (c && c.ads) {
                      gtag('consent', 'update', {
                        ad_user_data: 'granted',
                        ad_personalization: 'granted',
                        ad_storage: 'granted'
                      });
                    }
                  }
                } catch (_e) {}
                
                // Listen to our banner's event to update consent live
                window.addEventListener('amr:consent', function(e) {
                  var d = (e && e.detail) || {};
                  var updates = {};
                  if (d.analytics) updates.analytics_storage = 'granted';
                  if (d.ads) {
                    updates.ad_user_data = 'granted';
                    updates.ad_personalization = 'granted';
                    updates.ad_storage = 'granted';
                  }
                  if (Object.keys(updates).length) {
                    gtag('consent', 'update', updates);
                  }
                });
              `}
            </Script>

            {/* 2) Official GA4 loader */}
            <Script
              id="ga4-loader"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />

            {/* 3) Base GA4 config (no auto page_view; we send SPA views explicitly) */}
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                gtag('js', new Date());
                gtag('config', '${GA4_ID}', { send_page_view: false });
              `}
            </Script>
          </>
        )}
      </head>
      <body>
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
        {/* Mount after the rest of the UI; Suspense satisfies useSearchParams at build time */}
        <Suspense fallback={null}>
          <Ga4Pageview />
        </Suspense>
      </body>
    </html>
  );
}
