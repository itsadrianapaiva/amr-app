import { getGeneralConditionsDoc } from "@/lib/legal/build-general-conditions";
import {
  LEGAL_LINKS,
  type LegalLink,
  type LegalSection,
} from "@/lib/content/legal";
import PrintButton from "@/components/print-button";

// SEO metadata
export const metadata = {
  title: "General Rental Conditions | AMR",
  description:
    "AMR's General Rental Conditions for machinery and accessories — clauses, responsibilities, insurance, delivery/return, and disputes.",
  robots: { index: true, follow: true },
};

// Small helper for 'last updated'
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

export default async function GeneralConditionsPage() {
  const doc = await getGeneralConditionsDoc();

  return (
    <main className="container mx-auto px-4 py-18 md:py-24 xl:py-30">
      {/* Print-only CSS: hide floating WhatsApp and any fixed-position FABs when printing */}
      <style
        // Using a page-scoped style so we don't affect other routes.
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              /* Common selectors for WhatsApp FABs and similar widgets */
              a[href*="wa.me"],
              a[aria-label*="whatsapp" i],
              [data-social="whatsapp"],
              .whatsapp,
              .whatsapp-fab,
              .wa-chat,
              .wa-floating {
                display: none !important;
              }
              /* Any element using Tailwind's .fixed (floating UI) */
              .fixed {
                display: none !important;
              }
            }
          `,
        }}
      />

      {/* Header */}
      <header className="mb-10 md:mb-14">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {formatDate(doc.lastUpdated)}
        </p>
        {doc.intro && (
          <p className="mt-6 max-w-2xl text-muted-foreground">{doc.intro}</p>
        )}

        {/* Print / Save PDF */}
        <div className="mt-6 flex">
          <PrintButton className="ml-auto" />
        </div>
      </header>

      {/* Layout: ToC + Content */}
      <div className="grid gap-10 md:grid-cols-[280px,1fr] md:gap-14">
        {/* Table of contents (sticky) */}
        <nav className="order-last md:order-first">
          <div className="sticky top-24 rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">Clauses</p>
            <ul className="space-y-2 text-sm">
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>

            {/* Complaints book for compliance parity */}
            <div className="mt-4 border-t pt-4">
              <a
                href={LEGAL_LINKS.complaintsBook.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {LEGAL_LINKS.complaintsBook.label}
              </a>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <article className="prose max-w-none dark:prose-invert">
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="my-4 text-2xl font-semibold tracking-tight">
                {section.title}
              </h2>

              {section.body.map((para, i) => (
                <p key={i} className="text-muted-foreground">
                  {para}
                </p>
              ))}
            </section>
          ))}

          {/* Useful Links (e.g., complaints book, future PDF download) */}
          {doc.links && doc.links.length > 0 && (
            <section className="mt-10">
              <h3 className="mb-3 text-xl font-semibold tracking-tight">
                Useful Links
              </h3>
              <ul className="list-disc space-y-2 pl-6">
                {doc.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noopener noreferrer" : undefined}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </main>
  );
}
