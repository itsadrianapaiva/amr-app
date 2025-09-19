"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type HeroProps = {
  /** Small USP line above the headline */
  pretitle?: string;
  /** Calm headline; we keep it visually small on purpose */
  title?: string;
  subtitle?: string;

  primaryHref?: string;
  primaryLabel?: string;

  whatsappNumberE164?: string | null;
  whatsappLabel?: string;

  /** Keep existing classes for spacing/layout; bg image now comes from <Image>. */
  backgroundClassName?: string;

  /** Select which hero asset to render under /public/images/hero/*.jpg */
  imageName?: "hero" | "hero-02" | "hero-03";
};

export default function Hero({
  pretitle = "Instant online booking",
  title = "Rent pro-grade machinery in the Algarve",
  subtitle = "No quotes, no calls. Choose your machine, pick dates, pay a deposit. Delivery or pickup with local support.",
  primaryHref = "#catalog",
  primaryLabel = "Browse machines",
  whatsappNumberE164,
  whatsappLabel = "Need help? Chat on WhatsApp",
  backgroundClassName = "", // e.g. spacing/padding classes only
  imageName = "hero",
}: HeroProps) {
  // Minimal fade-in without external deps; subtle by design
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fadeIn = "transition-opacity duration-500 ease-out";
  const stage = mounted ? "opacity-100" : "opacity-0";
  const delay = (ms: number): CSSProperties => ({ transitionDelay: `${ms}ms` });

  // Build WhatsApp deep link only if provided
  const whatsappHref = useMemo(() => {
    if (!whatsappNumberE164) return null;
    const digits = whatsappNumberE164.replace(/[^\d]/g, "");
    return `https://wa.me/${digits}`;
  }, [whatsappNumberE164]);

  // Compute image src from the selected variant
  const heroSrc = `/images/hero/${imageName}.jpg`;

  return (
    <section
      className={[
        "relative h-[60vh] overflow-hidden",
        backgroundClassName,
      ].join(" ")}
    >
      {/* Background image — LCP friendly */}
      <Image
        src={heroSrc}
        alt="Tracked excavator working on a job site"
        fill
        /* Keep the image decisive for LCP: priority eagerly loads; fetchPriority hints the browser scheduler explicitly */
        priority
        fetchPriority="high"
        /* Full-bleed hero = the rendered width is the viewport width */
        sizes="100vw"
        className="absolute inset-0 object-cover"
      />

      {/* Dark gradient ensures contrast over any future photo */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/10 via-black/70 to-black/90" />

      <div className="container mx-auto flex h-full items-center px-4 md:px-8">
        <div className="z-20 mx-auto max-w-[608px] text-center text-white xl:mx-0 xl:text-left text-balance">
          {/* Pretitle: highlight our USP without shouting */}
          <p
            className={`text-sm md:text-md font-semibold uppercase tracking-wider text-white/80 ${fadeIn} ${stage}`}
            style={delay(60)}
          >
            {pretitle}
          </p>

          {/* Headline: visually small, calm, high contrast */}
          <h1
            className={`mt-2 text-3xl md:text-4xl font-bold leading-tight text-white/90 ${fadeIn} ${stage}`}
            style={delay(120)}
          >
            {title.split("machinery").length > 1 ? (
              <>
                {title.split("machinery")[0]}
                <span className="border-b border-accent text-white">
                  machinery
                </span>
                {title.split("machinery")[1]}
              </>
            ) : (
              title
            )}
          </h1>

          {/* Subtitle: one clear sentence about the flow */}
          <p
            className={`mt-4 text-base md:text-lg text-white/80 ${fadeIn} ${stage}`}
            style={delay(180)}
          >
            {subtitle}
          </p>

          {/* CTAs: strong primary, optional WhatsApp secondary */}
          <div
            className={`mt-7 flex flex-col justify-center items-center gap-3 sm:flex-row ${fadeIn} ${stage}`}
            style={delay(240)}
          >
            <Link href={primaryHref} prefetch={false}>
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                {primaryLabel}
              </Button>
            </Link>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                {whatsappLabel}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
