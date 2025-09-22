"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/* ---- Static imports give us: preload for priority images + blur placeholders */
import hero01 from "@/public/images/hero/hero.jpg";
import hero02 from "@/public/images/hero/hero-02.jpg";
import hero03 from "@/public/images/hero/hero-03.jpg";

type HeroProps = {
  pretitle?: string;
  title?: string;
  subtitle?: string;
  primaryHref?: string;
  primaryLabel?: string;
  whatsappNumberE164?: string | null;
  whatsappLabel?: string;
  backgroundClassName?: string;
  imageName?: "hero" | "hero-02" | "hero-03";
};

const HERO_IMAGES: Record<NonNullable<HeroProps["imageName"]>, any> = {
  hero: hero01,
  "hero-02": hero02,
  "hero-03": hero03,
};

export default function Hero({
  pretitle = "Instant online booking",
  title = "Rent pro-grade machinery in the Algarve",
  subtitle = "No quotes, no calls. Choose your machine, pick dates, pay a deposit. Delivery or pickup with local support.",
  primaryHref = "#catalog",
  primaryLabel = "Browse machines",
  whatsappNumberE164,
  whatsappLabel = "Need help? Chat on WhatsApp",
  backgroundClassName = "",
  imageName = "hero",
}: HeroProps) {
  // Minimal fade-in
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

  // Choose statically imported image (unlocks blur + automatic preload for priority)
  const heroImg = HERO_IMAGES[imageName] ?? HERO_IMAGES["hero"];

  return (
    <section
      className={[
        // Reserve stable height to avoid CLS; 64vh gives a bit more breathing room
        "relative min-h-[64vh] overflow-hidden",
        backgroundClassName,
      ].join(" ")}
    >
      {/* Background image — LCP target */}
      <Image
        src={heroImg}
        alt="Tracked excavator working on a job site"
        // Fill inside a container with a stable min-height → no layout jump
        fill
        // LCP boosters
        priority
        fetchPriority="high"
        // Right-sizing: the hero is always full-bleed width
        sizes="100vw"
        // Reduce bytes a touch without visible quality loss
        quality={78}
        // Blur prevents harsh placeholder and improves perceived LCP
        placeholder="blur"
        className="absolute inset-0 object-cover"
      />

      {/* Contrast guard */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/10 via-black/70 to-black/90" />

      <div className="container mx-auto flex min-h-[64vh] items-center px-4 md:px-8">
        <div className="z-20 mx-auto max-w-[608px] text-center text-white xl:mx-0 xl:text-left text-balance">
          <p
            className={`text-sm md:text-md font-semibold uppercase tracking-wider text-white/80 ${fadeIn} ${stage}`}
            style={delay(60)}
          >
            {pretitle}
          </p>

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

          <p
            className={`mt-4 text-base md:text-lg text-white/80 ${fadeIn} ${stage}`}
            style={delay(180)}
          >
            {subtitle}
          </p>

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
