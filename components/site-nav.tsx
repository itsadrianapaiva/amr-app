"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { NAV_CONTENT } from "@/lib/content/nav";
import Logo from "@/components/logo";
import {
  Sheet,
  SheetContent, // kept to ensure consistent animation/layout; MobileMenu renders inside
  SheetTrigger,
} from "@/components/ui/sheet";

// Load the heavy mobile menu code only on demand (client-side).
const MobileMenu = dynamic(() => import("@/components/nav/mobile-menu"), {
  ssr: false,
  loading: () => null, // no flicker; the Sheet opens when content is ready
});

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

  const logoSrc = headerActive
    ? "/assets/logo-bw.png"
    : "/assets/logo-yellow.png";

  return (
    <header className={`sticky top-0 z-50 transition-colors ${headerClasses}`}>
      <div className="container mx-auto px-4 md:px-6 lg:px-8 xl:px-10">
        {/* Taller row + padding to avoid any clipping */}
        <div className="flex min-h-[120px] items-center justify-between py-2">
          {/* Reserved logo box prevents reflow when swapping src */}
          <div className="h-14 w-[160px] shrink-0 flex items-center">
            <Logo src={logoSrc} width={160} height={48} />
          </div>

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

            {NAV_CONTENT.uspShort ? (
              <span className="hidden rounded-full border border-border px-3 py-1 text-xs text-muted-foreground lg:inline uppercase">
                {NAV_CONTENT.uspShort}
              </span>
            ) : null}

            <Link
              href={NAV_CONTENT.primaryCta.href}
              prefetch={false}
              className="ml-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground border border-primary-foreground hover:opacity-90"
            >
              {NAV_CONTENT.primaryCta.label}
            </Link>
          </nav>

          {/* Mobile trigger (bundle-splitting: MobileMenu loads only when needed) */}
          <div className="md:hidden shrink-0">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                aria-label="Open menu"
                className="inline-flex h-12 w-12 items-center justify-center"
              >
                <Menu className="h-8 w-8" />
              </SheetTrigger>
              {/* Keep <SheetContent> SSR to reserve space/animation shell; actual menu is lazy */}
              <SheetContent
                side="right"
                className="p-0 border-0 bg-transparent"
              >
                {/* When the dynamic chunk is ready, render full menu */}
                <MobileMenu onClose={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
