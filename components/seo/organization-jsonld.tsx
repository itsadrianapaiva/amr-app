import "server-only";
import React from "react";
import { getCompanyProfile } from "@/lib/company/profile";

/**
 * Server Component that injects Organization + Website JSON-LD.
 * Hydrates from live AMR profile (env + content) to avoid stale CEU data.
 * Render once in app/layout.tsx (inside <body>).
 */
export default async function OrganizationJsonLd() {
  const p = await getCompanyProfile();

  // Prefer canonical site from profile; fall back to env/public; finally default.
  const site =
    (p.website || process.env.NEXT_PUBLIC_SITE_URL || "https://amr-rentals.com")
      .toString()
      .replace(/\/+$/, "");

  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      // Marketing / display name
      name: p.name || "AMR - Algarve Machinery Rental",
      // Registered legal name for compliance
      legalName: p.legalName || "AMR - Machinery Rental",
      url: site,
      // Contact points (keep minimal and truthful)
      email: p.emailSupport ? `mailto:${p.emailSupport}` : undefined,
      telephone: p.phone || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || undefined,
      // Keep PostalAddress minimal to avoid brittle parsing until we store structured fields
      address: {
        "@type": "PostalAddress",
        addressCountry: "PT",
      },
      sameAs: [] as string[], // fill when social profiles are ready
      logo: {
        "@type": "ImageObject",
        url: `${site}/icon1.png`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: p.name || "AMR - Algarve Machinery Rental",
      url: site,
      potentialAction: {
        "@type": "SearchAction",
        target: `${site}/catalog?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Safe because we fully control the content
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
