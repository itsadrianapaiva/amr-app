import React from "react";

/**
 * ProductJsonLd — Server Component
 * Emits schema.org Product + Offer JSON-LD for a machine detail page.
 *
 * Props:
 * - id: machine DB id (number or string) — used in url/sku
 * - name: machine name
 * - description: short, plain-text description
 * - image: absolute or path-relative URL to a representative image
 * - dailyRate: price per day in EUR (number or string)
 *
 * Usage (next step in page.tsx):
 *   <ProductJsonLd
 *     id={machine.id}
 *     name={machine.name}
 *     description={machine.description}
 *     image={machine.imageUrl} // OK for now; swap to curated asset later
 *     dailyRate={machine.dailyRate}
 *   />
 */
export default function ProductJsonLd(props: {
  id: number | string;
  name: string;
  description: string;
  image?: string | null;
  dailyRate: number | string;
}) {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://amr-rentals.com";

  const id = String(props.id);
  const url = `${site}/machine/${encodeURIComponent(id)}`;

  // Prefer provided image; fall back to a generic brand icon to avoid empty arrays.
  const image =
    (props.image && (props.image.startsWith("http") ? props.image : `${site}${props.image.startsWith("/") ? "" : "/"}${props.image}`)) ||
    `${site}/icon1.png`;

  // Ensure price is a string with dot decimal for JSON-LD
  const price =
    typeof props.dailyRate === "number"
      ? props.dailyRate.toFixed(2)
      : String(props.dailyRate);

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: props.name,
    description: props.description,
    sku: id,
    url,
    image: [image],
    brand: {
      "@type": "Organization",
      name: "AMR - Algarve Machinery Rental",
      url: site,
      logo: `${site}/icon1.png`,
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition", // adjust to NewCondition if appropriate
      seller: {
        "@type": "Organization",
        name: "AMR - Machinery Rental",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
