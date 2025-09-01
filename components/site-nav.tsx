"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { NAV_CONTENT } from "@/lib/content/nav";
import Logo from "@/components/logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** P4-style mobile menu: centered logo, bold spacing, white on primary. */
function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <SheetContent
      side="right"
      className="border-none bg-secondary-foreground text-primary-foreground"
    >
      <div className="flex h-full flex-col items-center justify-start pb-8 pt-12">
        <SheetHeader>
          <SheetTitle>
            <div className="cursor-pointer" onClick={onClose}>
              <Logo src="/assets/logo-bw.png" width={160} height={40} />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navigation menu
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-12 flex w-full flex-col justify-center gap-10 text-center">
          {NAV_CONTENT.links.map((link) => (
            <li
              key={link.href}
              className="text-sm font-medium uppercase tracking-[1.2px] text-primary-foreground"
            >
              <Link
                href={link.href}
                prefetch={false}
                className="cursor-pointer"
                onClick={onClose}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            href={NAV_CONTENT.primaryCta.href}
            prefetch={false}
            onClick={onClose}
            className="inline-flex rounded-lg bg-accent px-8 py-2 text-sm font-semibold text-primary-foreground border border-primary-foreground hover:bg-accent/80"
          >
            {NAV_CONTENT.primaryCta.label}
          </Link>
        </div>

        {/* Optional socials/contacts could go here later */}
      </div>
    </SheetContent>
  );
}

/**
 * SiteNav
 * Transparent over hero, solid on scroll.
 * Wider desktop padding; P4-style mobile sheet; dynamic trigger color.
 */
export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [headerActive, setHeaderActive] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderActive(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerClasses = headerActive
    ? "border-b border-border/60 bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60"
    : "border-b border-transparent bg-transparent";

  // Transparent header uses yellow; solid uses B&W.
  const logoSrc = headerActive
    ? "/assets/logo-bw.png"
    : "/assets/logo-yellow.png";

  return (
    <header className={`sticky top-0 z-50 transition-colors ${headerClasses}`}>
      {/* Extra horizontal padding so the CTA isn't glued to the right edge */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 xl:px-10">
        <div className="flex min-h-[72px] items-center justify-between md:min-h-[88px]">
          {/* Brand */}
          <Logo src={logoSrc} width={160} height={48} />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <ul className="flex items-center gap-6">
              {NAV_CONTENT.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={false}
                    className="text-sm text-muted-foreground hover:text-foreground uppercase tracking-wider"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Small USP badge */}
            {NAV_CONTENT.uspShort ? (
              <span className="hidden rounded-full border border-border px-3 py-1 text-xs text-muted-foreground lg:inline uppercase">
                {NAV_CONTENT.uspShort}
              </span>
            ) : null}

            {/* Primary CTA */}
            <Link
              href={NAV_CONTENT.primaryCta.href}
              prefetch={false}
              className="ml-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground border border-primary-foreground hover:opacity-90"
            >
              {NAV_CONTENT.primaryCta.label}
            </Link>
          </nav>

          {/* Mobile trigger — white over hero, regular when solid */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                aria-label="Open menu"
                className="inline-flex h-18 w-18 items-center justify-center"
              >
                {" "}
                <Menu className="h-10 w-10 mr-8" />
              </SheetTrigger>
              <MobileMenu onClose={() => setOpen(false)} />
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
