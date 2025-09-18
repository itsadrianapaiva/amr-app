import React from "react";

/**
 * UPDATE TELEPHONE
 * Server Component that injects Organization + Website JSON-LD.
 * Keep it minimal and truthful. Update fields as needed.
 *
 * Usage (next step): render once in app/layout.tsx (inside <body>)
 */
export default function OrganizationJsonLd() {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://amr-rentals.com";

  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "AMR - Algarve Machinery Rental",
      url: site,
      legalName: "AMR - Machinery Rental",
      email: "mailto:support@amr-rentals.com",
      telephone: "+351-000-000-000",
      address: {
        "@type": "PostalAddress",
        addressCountry: "PT",
        addressLocality: "Aljezur",
      },
      sameAs: [
        // Fill any that exist; keep empty array if none
        // "https://www.facebook.com/…",
        // "https://www.instagram.com/…",
        // "https://www.linkedin.com/company/…",
      ],
      logo: {
        "@type": "ImageObject",
        url: `${site}/icon1.png`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "AMR - Algarve Machinery Rental",
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
