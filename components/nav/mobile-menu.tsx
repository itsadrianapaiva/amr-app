"use client";

import Link from "next/link";
import Logo from "@/components/logo";
import { NAV_CONTENT } from "@/lib/content/nav";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ScrollLink from "@/components/nav/scroll-link";

// Match the desktop sticky header overlap
const STICKY_OFFSET = 112;

/**
 * MobileMenu
 * - Lives inside a <Sheet> provided by the caller.
 * - Pure presentational; caller controls open/close state.
 */
export default function MobileMenu({ onClose }: { onClose: () => void }) {
  // Helpers to detect in-page targets like "/#contact"
  const isInPage = (href: string) => href.startsWith("/#");
  const sectionId = (href: string) => href.slice(2); // "/#faq" -> "faq"

  return (
    <SheetContent
      side="right"
      className="border-none bg-secondary-foreground text-primary-foreground"
    >
      <div className="flex h-full flex-col items-center justify-start pb-8 pt-12">
        <SheetHeader>
          <SheetTitle>
            {/* Clean URL scroll-to-home, and close the menu */}
            <ScrollLink
              to="home"
              offset={STICKY_OFFSET}
              ariaLabel="Go to home"
              className="cursor-pointer inline-flex"
              onClick={onClose}
            >
              {/* Render plain <img> (no internal link) */}
              <Logo
                href={undefined}
                src="/assets/logo-bw.png"
                width={220}
                height={66}
                variant="nav"
                sizing="fixed"
              />
            </ScrollLink>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navigation menu
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-12 flex w-full flex-col justify-center gap-10 text-center">
          {NAV_CONTENT.links.map((link) => (
            <li
              key={link.href}
              className="text-md font-medium uppercase tracking-[1.2px] text-primary-foreground"
            >
              {isInPage(link.href) ? (
                <ScrollLink
                  to={sectionId(link.href)}
                  offset={STICKY_OFFSET}
                  className="cursor-pointer"
                  onClick={onClose}
                  ariaLabel={`Go to ${sectionId(link.href)} section`}
                >
                  {link.label}
                </ScrollLink>
              ) : (
                <Link
                  href={link.href}
                  prefetch={false}
                  className="cursor-pointer"
                  onClick={onClose}
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-10">
          {/* Primary CTA: if in-page, scroll-clean + close; else normal link */}
          {isInPage(NAV_CONTENT.primaryCta.href) ? (
            <ScrollLink
              to={sectionId(NAV_CONTENT.primaryCta.href)}
              offset={STICKY_OFFSET}
              onClick={onClose}
              className="inline-flex rounded-lg bg-accent px-10 py-2 text-md font-semibold text-primary-foreground border border-primary-foreground hover:bg-accent/80"
              ariaLabel={`Go to ${sectionId(NAV_CONTENT.primaryCta.href)} section`}
            >
              {NAV_CONTENT.primaryCta.label}
            </ScrollLink>
          ) : (
            <Link
              href={NAV_CONTENT.primaryCta.href}
              prefetch={false}
              onClick={onClose}
              className="inline-flex rounded-lg bg-accent px-10 py-2 text-md font-semibold text-primary-foreground border border-primary-foreground hover:bg-accent/80"
            >
              {NAV_CONTENT.primaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </SheetContent>
  );
}
