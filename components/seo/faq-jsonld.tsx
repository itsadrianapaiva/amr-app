/**
 * FAQPageJsonLd — Server Component
 * Emits schema.org FAQPage JSON-LD from a simple Q/A array.
 *
 * Usage (next step, in your FAQ page):
 *   <FAQPageJsonLd
 *     items={[
 *       { question: "Do you deliver?", answer: "Yes, across the Algarve." },
 *       { question: "How is VAT handled?", answer: "23% VAT shown before checkout." },
 *     ]}
 *   />
 */
export default function FAQPageJsonLd(props: {
    items: Array<{ question: string; answer: string }>;
  }) {
    const site =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://amr-rentals.com";
  
    // Build schema.org structure
    const data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: props.items.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    };
  
    return (
      <script
        type="application/ld+json"
        // Safe because we fully control the payload (server-side render)
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        data-origin={site}
      />
    );
  }
  