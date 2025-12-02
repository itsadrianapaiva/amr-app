import Image from "next/image";
import { FOOTER_TRUST_LOGOS } from "@/lib/content/footer-trust-logos";
import { cn } from "@/lib/utils";

type FooterTrustBarProps = {
  className?: string;
};

/**
 * FooterTrustBar
 * Displays trust logos (payment methods and platforms) in the footer,
 * positioned above the copyright bar for visual reinforcement.
 */
export default function FooterTrustBar({
  className,
}: FooterTrustBarProps = {}) {
  return (
    <div
      className={cn("border-t border-primary-foreground/15", className)}
    >
      <div
        className="container mx-auto flex flex-wrap items-center justify-center gap-4 py-4 px-4 md:justify-evenly"
        aria-label="Trusted platforms and payment methods"
      >
        {FOOTER_TRUST_LOGOS.map((logo) => (
          <div key={logo.id} className="flex items-center justify-center">
            <Image
              src={logo.imageSrc}
              alt={logo.alt}
              width={120}
              height={28}
              className="h-4 w-auto md:h-7"
              sizes="(min-width: 1024px) 120px, 80px"
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
