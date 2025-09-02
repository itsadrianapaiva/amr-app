// components/site-footer.tsx
import Link from "next/link";
import Logo from "@/components/logo";
import { FOOTER_CONTENT } from "@/lib/content/footer";
import { MapPin, Phone, Mail } from "lucide-react";

/**
 * SiteFooter
 * Restyled to match NavMobile:
 * - Dark surface: bg-secondary-foreground
 * - Light text: text-primary-foreground
 * - primary details + bordered CTA style carried over for interactive elements
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();
  const owner = FOOTER_CONTENT.copyrightOwner ?? FOOTER_CONTENT.companyName;

  // Inline for now to avoid changing content files during MVP.
  const legalLinks: { href: string; label: string; external?: boolean }[] = [
    { href: "/legal/privacy", label: "Privacy" },
    { href: "/legal/terms", label: "Terms" },
    {
      href: "https://www.livroreclamacoes.pt/inicio/",
      label: "Livro de Reclamações",
      external: true,
    },
  ];

  return (
    <footer className="mt-10 bg-secondary-foreground text-primary-foreground xl:mt-32">
      <div className="container mx-auto">
        {/* Top section: centered on mobile, two columns on xl (mirrors NavMobile centered feel) */}
        <div className="flex flex-col items-center justify-center gap-12 py-8 md:flex-row xl:items-start xl:gap-10 xl:py-20">
          {/* Logo block — NavMobile uses the B&W logo on dark bg */}
          <div className="mb-2 flex flex-1 justify-center">
            <Logo
              src="/assets/logo-yellow.png"
              width={200}
              height={56}
              alt={FOOTER_CONTENT.companyName}
            />
          </div>

          {/* Contact block */}
          <div className="flex-1">
            <h4 className="mb-6 text-md font-semibold uppercase tracking-[1.2px]">
              Contact
            </h4>

            <ul className="flex flex-col gap-5 text-sm">
              {/* Address */}
              <li className="flex items-start gap-3">
                <MapPin className="mt-[2px] h-5 w-5 text-primary" />
                <div className="opacity-90">
                  {FOOTER_CONTENT.addressLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </li>

              {/* Phone (optional) */}
              {FOOTER_CONTENT.phoneDisplay && (
                <li className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="opacity-90">{FOOTER_CONTENT.phoneDisplay}</span>
                </li>
              )}

              {/* Email (optional) */}
              {FOOTER_CONTENT.email && (
                <li className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <Link
                    href={`mailto:${FOOTER_CONTENT.email}`}
                    className="underline opacity-90 hover:no-underline"
                  >
                    {FOOTER_CONTENT.email}
                  </Link>
                </li>
              )}
            </ul>

            {/* Small CTA (optional, content-driven) */}
            {FOOTER_CONTENT.footerCta && (
              <div className="mt-8">
                <Link
                  href={FOOTER_CONTENT.footerCta.href}
                  prefetch={false}
                  className="inline-flex rounded-lg bg-primary px-12 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent/80"
                >
                  {FOOTER_CONTENT.footerCta.label}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar — add inline Legal nav while preserving layout */}
      <div className="border-t border-primary-foreground/15">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 py-4 text-xs uppercase tracking-[0.8px] md:flex-row">
          <p className="opacity-80">
            &copy; {year} {owner}. All rights reserved.
          </p>

          {/* Inline legal nav */}
          <nav className="flex flex-wrap items-center gap-3 opacity-80">
            {legalLinks.map((l, i) => {
              const isLast = i === legalLinks.length - 1;
              return (
                <span key={l.href} className="flex items-center gap-3">
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="underline hover:no-underline">
                      {l.label}
                    </Link>
                  )}
                  {!isLast && <span aria-hidden="true">•</span>}
                </span>
              );
            })}
          </nav>

          {FOOTER_CONTENT.designedBy ? (
            <p className="opacity-80">
              Designed by{" "}
              <a
                href={FOOTER_CONTENT.designedBy.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                {FOOTER_CONTENT.designedBy.label}
              </a>
            </p>
          ) : (
            <span />
          )}
        </div>
      </div>
    </footer>
  );
}
