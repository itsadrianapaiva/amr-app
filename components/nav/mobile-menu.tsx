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

/**
 * MobileMenu
 * - Lives inside a <Sheet> provided by the caller.
 * - Pure presentational; caller controls open/close state.
 */
export default function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <SheetContent
      side="right"
      className="border-none bg-secondary-foreground text-primary-foreground"
    >
      <div className="flex h-full flex-col items-center justify-start pb-8 pt-12">
        <SheetHeader>
          <SheetTitle>
            <div className="cursor-pointer" onClick={onClose}>
              <Logo
                src="/assets/logo-bw.png"
                width={200} // medium: larger than nav, smaller than footer
                height={66} // keeps ~3.33:1 ratio consistent with header usage
                variant="nav" // sizing hint is fine to reuse "nav"
                sizing="fixed" // ensures the width renders at 220px
              />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navigation menu
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-10 flex w-full flex-col justify-center gap-10 text-center">
          {NAV_CONTENT.links.map((link) => (
            <li
              key={link.href}
              className="text-md font-medium uppercase tracking-[1.2px] text-primary-foreground"
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
            className="inline-flex rounded-lg bg-accent px-10 py-2 text-md font-semibold text-primary-foreground border border-primary-foreground hover:bg-accent/80"
          >
            {NAV_CONTENT.primaryCta.label}
          </Link>
        </div>
      </div>
    </SheetContent>
  );
}
