import Link from "next/link";
import Logo from "@/components/logo";
import { FOOTER_CONTENT } from "@/lib/content/footer";
import { MapPin, Phone, Mail } from "lucide-react";

/**
 * SiteFooter — 4-column layout on xl:
 * [Logo] [Contact] [Categories] [Pages]
 * NOTE: Categories are injected via props to avoid DB calls here.
 */
type SiteFooterProps = {
  /** Friendly category labels to show; if empty/undefined, the "Categories" column is hidden. */
  categories?: string[];
};

export default function SiteFooter({ categories }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const owner = FOOTER_CONTENT.copyrightOwner ?? FOOTER_CONTENT.companyName;

  const pageLinks: { href: string; label: string; external?: boolean }[] = [
    { href: "/#home", label: "Home" },
    { href: "/#catalog", label: "Catalog" },
    { href: "/#contact", label: "Contact" },
    { href: "/#faq", label: "FAQ" },
    { href: "/legal/privacy", label: "Privacy" },
    { href: "/legal/terms", label: "Terms" },
    { href: "/legal/cookies", label: "Cookies" },
    { href: "/legal/general-conditions", label: "General Rental Conditions" },
    {
      href: "https://www.livroreclamacoes.pt/inicio/",
      label: "Livro de Reclamações",
      external: true,
    },
  ];

  return (
    <footer className="mt-10 bg-muted-foreground/10 text-primary-foreground xl:mt-32">
      <div className="container mx-auto">
        {/* Top grid: stacks on mobile, four columns on xl */}
        <div className="grid gap-12 py-8 px-20 md:grid-cols-2 xl:grid-cols-4 xl:gap-10 xl:py-20">
          {/* Logo */}
          <div className="flex items-start justify-center xl:justify-start">
            <Logo
              src="/assets/logo-yellow.png"
              width={200}
              height={56}
              alt={FOOTER_CONTENT.companyName}
            />
          </div>

          {/* Contact */}
          <div>
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
                  <span className="opacity-90">
                    {FOOTER_CONTENT.phoneDisplay}
                  </span>
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

            {/* Small CTA (optional) */}
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

          {/* Categories — shown only if provided */}
          {categories && categories.length > 0 ? (
            <div>
              <h4 className="mb-6 text-md font-semibold uppercase tracking-[1.2px]">
                Categories
              </h4>
              <ul className="space-y-3 text-sm opacity-90">
                {categories.map((label) => (
                  <li key={label}>
                    <Link
                      href={`/?category=${encodeURIComponent(label)}#catalog`}
                      prefetch={false}
                      className="underline hover:no-underline"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            // Keep grid alignment on xl (renders an empty slot)
            <div aria-hidden className="hidden xl:block" />
          )}

          {/* Pages */}
          <div>
            <h4 className="mb-6 text-md font-semibold uppercase tracking-[1.2px]">
              Pages
            </h4>
            <ul className="space-y-3 text-sm opacity-90">
              {pageLinks.map((l) => (
                <li key={l.href}>
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
                    <Link
                      href={l.href}
                      prefetch={false}
                      className="underline hover:no-underline"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar — unchanged */}
      <div className="border-t border-primary-foreground/15">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 py-4 text-xs uppercase tracking-[0.8px] md:flex-row">
          <p className="opacity-80">
            &copy; {year} {owner}. All rights reserved.
          </p>

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
