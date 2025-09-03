import { LEGAL_COOKIES, LEGAL_LINKS } from "@/lib/content/legal";

export const metadata = {
  title: "Cookies Policy | AMR",
  description: "What cookies we use and how to control them.",
  robots: { index: true, follow: true },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

export default async function CookiesPage() {
  const doc = LEGAL_COOKIES;

  return (
    <main className="container mx-auto px-4 py-18 md:py-24 xl:py-30">
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
      </header>

      {/* Layout: ToC + Content */}
      <div className="grid gap-10 md:grid-cols-[280px,1fr] md:gap-14">
        {/* Table of contents */}
        <nav className="order-last md:order-first">
          <div className="sticky top-24 rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">On this page</p>
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

            {/* Complaints book link kept for parity with other legal pages */}
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

          {/* External links, if any */}
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
