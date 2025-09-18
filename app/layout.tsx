import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import WhatsAppFab from "@/components/whatsapp-fab";
import { getFooterCategories } from "@/lib/data/footer-categories";
import CookieConsentBanner from "@/components/cookie-consent";
import { createDefaultMetadata } from "@/lib/seo/default-metadata";

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
  // Per-page routes can still override alternates.canonical when needed
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon1.png", type: "image/png", sizes: "512x512" },
      { url: "/icon0.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const footerCategories = await getFooterCategories();
  return (
    <html lang="en">
      <body>
        {/* Invisible anchor so '/#home' targets the very top */}
        <div id="home" className="sr-only" aria-hidden="true" />

        {/* Sticky header on all pages */}
        <SiteNav />

        {/* Page content (HomeView renders <main/>) */}
        {children}

        {/* Global footer on all pages */}
        <SiteFooter categories={footerCategories} />

        {/* Floating WhatsApp button */}
        <WhatsAppFab
          iconSrc="/assets/whatsapp.png"
          ariaLabel="Contact us on WhatsApp"
        />

        {/* Cookie consent banner (client component) */}
        <CookieConsentBanner policyHref="/legal/privacy" />
      </body>
    </html>
  );
}
