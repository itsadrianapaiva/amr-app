"use client";

import Link from "next/link";
import Logo from "@/components/logo";
import { AMR_LOGO_BW } from "@/components/logo";
import { NAV_CONTENT } from "@/lib/content/nav";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ScrollLink from "@/components/nav/scroll-link";
import { usePathname, useRouter } from "next/navigation";

const STICKY_OFFSET = 112;

export default function MobileMenu({ onClose }: { onClose: () => void }) {
  const isInPage = (href: string) => href.startsWith("/#");
  const sectionId = (href: string) => href.slice(2);

  const pathname = usePathname();
  const router = useRouter();

  const handleHomeClick = () => {
    onClose();
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/", { scroll: true }); // clean URL, scroll top; no hash
  };

  return (
    <SheetContent
      side="right"
      className="border-none bg-secondary-foreground text-primary-foreground"
    >
      <div className="flex h-full flex-col items-center justify-start pb-8 pt-12">
        <SheetHeader className="w-full px-2">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SheetDescription className="sr-only">
            Choose a section to navigate
          </SheetDescription>

          {/* Logo uses the same Home rule */}
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={handleHomeClick}
              aria-label="Go to home"
              className="inline-flex cursor-pointer"
            >
              <Logo
                href={undefined}
                src={AMR_LOGO_BW}
                width={220}
                height={66}
                variant="nav"
                sizing="fixed"
              />
            </button>
          </div>
        </SheetHeader>

        <ul className="mt-12 flex w-full flex-col justify-center gap-10 text-center">
          {NAV_CONTENT.links.map((link) => {
            const isHomeInPage =
              isInPage(link.href) && sectionId(link.href) === "home";

            return (
              <li
                key={link.href}
                className="text-md font-medium uppercase tracking-[1.2px] text-primary-foreground"
              >
                {isHomeInPage ? (
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    className="cursor-pointer"
                    aria-label="Go to home"
                  >
                    {link.label}
                  </button>
                ) : isInPage(link.href) ? (
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
            );
          })}
        </ul>

        <div className="mt-10">
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
