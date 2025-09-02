import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import WhatsAppFab from "@/components/whatsapp-fab";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AMR — Machinery Rentals in the Algarve",
  description: "Instant online booking for pro-grade machinery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Invisible anchor so '/#home' targets the very top */}
        <div id="home" className="sr-only" aria-hidden="true" />

        {/* Sticky header on all pages */}
        <SiteNav />

        {/* Page content (HomeView renders <main/>) */}
        {children}

        {/* Global footer on all pages */}
        <SiteFooter />

        {/* Floating WhatsApp button */}
        <WhatsAppFab
          iconSrc="/assets/whatsapp.png"
          ariaLabel="Contact us on WhatsApp"
        />
      </body>
    </html>
  );
}
