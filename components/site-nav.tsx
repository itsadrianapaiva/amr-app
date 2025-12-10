"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { NAV_CONTENT } from "@/lib/content/nav";
import { SOCIAL_LINKS } from "@/lib/content/social";
import { SocialIcon } from "@/components/social/SocialIcon";
import Logo from "@/components/logo";
import { AMR_LOGO_YELLOW, AMR_LOGO_BW } from "@/components/logo";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import ScrollLink from "@/components/nav/scroll-link";
import { usePathname, useRouter } from "next/navigation";
import { trackGaCatalogNavClick } from "@/components/analytics/ga4-clicking";
import { metaCtaClick } from "@/lib/analytics/metaEvents";
import MobileMenu from "@/components/nav/mobile-menu";

const STICKY_OFFSET = 112;

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [headerActive, setHeaderActive] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setHeaderActive(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerClasses = headerActive
    ? "border-b border-border/60 bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60"
    : "border-b border-transparent bg-transparent";

  const logoSrc = headerActive ? AMR_LOGO_BW : AMR_LOGO_YELLOW;

  const isInPage = (href: string) => href.startsWith("/#");
  const sectionId = (href: string) => href.slice(2); // "/#catalog" -> "catalog"

  const handleHomeClick = () => {
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/", { scroll: true }); // clean URL, top of page
  };

  return (
    <header className={`sticky top-0 z-50 transition-colors ${headerClasses}`}>
      <div className="container mx-auto px-4 md:px-6 lg:px-8 xl:px-10">
        <div className="flex min-h-[120px] items-center justify-between">
          {/* Reserved logo box prevents reflow when swapping src */}
          <div className="shrink-0 flex items-center w-[200px] h-[60px] p-4">
            <button
              type="button"
              onClick={handleHomeClick}
              aria-label="Go to home"
              className="inline-flex items-center cursor-pointer"
            >
              <Logo
                href={undefined}
                src={logoSrc}
                width={200}
                variant="nav"
                sizing="auto"
              />
            </button>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <ul className="flex items-center gap-6">
              {NAV_CONTENT.links.map((link) => {
                const isHomeInPage =
                  isInPage(link.href) && sectionId(link.href) === "home";

                return (
                  <li key={link.href}>
                    {isHomeInPage ? (
                      <button
                        type="button"
                        onClick={handleHomeClick}
                        className="text-sm text-muted-foreground hover:text-foreground uppercase tracking-wider cursor-pointer"
                        aria-label="Go to home"
                      >
                        {link.label}
                      </button>
                    ) : isInPage(link.href) ? (
                      <ScrollLink
                        to={sectionId(link.href)}
                        offset={STICKY_OFFSET}
                        className="text-sm text-muted-foreground hover:text-foreground uppercase tracking-wider"
                        ariaLabel={`Go to ${sectionId(link.href)} section`}
                      >
                        {link.label}
                      </ScrollLink>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground uppercase tracking-wider"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>

            {NAV_CONTENT.uspShort ? (
              <span className="hidden rounded-full border border-border px-3 py-1 text-xs text-muted-foreground lg:inline uppercase">
                {NAV_CONTENT.uspShort}
              </span>
            ) : null}

            <div className="hidden items-center gap-3 lg:flex">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Visit AMR on ${link.label}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <SocialIcon id={link.id} className="h-5 w-5" />
                </a>
              ))}
            </div>

            {/* Primary CTA with tracking */}
            {isInPage(NAV_CONTENT.primaryCta.href) ? (
              <ScrollLink
                to={sectionId(NAV_CONTENT.primaryCta.href)}
                offset={STICKY_OFFSET}
                className="ml-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground border border-primary-foreground hover:opacity-90"
                ariaLabel={`Go to ${sectionId(NAV_CONTENT.primaryCta.href)} section`}
                onClick={() => {
                  const section = sectionId(NAV_CONTENT.primaryCta.href);
                  if (section === "catalog") {
                    trackGaCatalogNavClick({
                      link_text: NAV_CONTENT.primaryCta.label,
                      link_location: "nav",
                    });
                    metaCtaClick({
                      cta_type: "catalog_nav",
                      cta_text: NAV_CONTENT.primaryCta.label,
                      cta_destination: NAV_CONTENT.primaryCta.href,
                      cta_location: "nav",
                    });
                  }
                }}
              >
                {NAV_CONTENT.primaryCta.label}
              </ScrollLink>
            ) : (
              <Link
                href={NAV_CONTENT.primaryCta.href}
                className="ml-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground border border-primary-foreground hover:opacity-90"
                onClick={() => {
                  if (NAV_CONTENT.primaryCta.href.includes("catalog")) {
                    trackGaCatalogNavClick({
                      link_text: NAV_CONTENT.primaryCta.label,
                      link_location: "nav",
                    });
                    metaCtaClick({
                      cta_type: "catalog_nav",
                      cta_text: NAV_CONTENT.primaryCta.label,
                      cta_destination: NAV_CONTENT.primaryCta.href,
                      cta_location: "nav",
                    });
                  }
                }}
              >
                {NAV_CONTENT.primaryCta.label}
              </Link>
            )}
          </nav>

          {/* Mobile trigger */}
          <div className="md:hidden shrink-0">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                aria-label="Open menu"
                className="inline-flex h-12 w-12 items-center justify-center"
              >
                <Menu className="h-10 w-10" />
              </SheetTrigger>
              <MobileMenu onClose={() => setOpen(false)} />
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
