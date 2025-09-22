import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/* Static imports unlock intrinsic size + blur + preload for priority */
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

const HERO_IMAGES: Record<NonNullable<HeroProps["imageName"]>, StaticImageData> = {
  "hero": hero01,
  "hero-02": hero02,
  "hero-03": hero03,
};

/** Build a WhatsApp deep link from E.164 (server-safe, no DOM API). */
function buildWhatsAppHref(e164?: string | null) {
  if (!e164) return null;
  const digits = e164.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

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
  const heroImg = HERO_IMAGES[imageName] ?? HERO_IMAGES["hero"];
  const whatsappHref = buildWhatsAppHref(whatsappNumberE164);

  return (
    <section
      className={[
        // Stable height to avoid CLS
        "relative min-h-[64vh] overflow-hidden",
        backgroundClassName,
      ].join(" ")}
    >
      {/* Background image — LCP target (no animation to avoid delaying paint) */}
      <Image
        src={heroImg}
        alt="Tracked excavator working on a job site"
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        quality={78}
        placeholder="blur"
        className="absolute inset-0 object-cover"
      />

      {/* Contrast guard (can fade subtly) */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/10 via-black/70 to-black/90 fade-in fade-in-100" />

      <div className="container mx-auto flex min-h-[64vh] items-center px-4 md:px-8">
        <div className="z-20 mx-auto max-w-[608px] text-center text-white xl:mx-0 xl:text-left text-balance">
          {/* Pretitle */}
          <p className="text-sm md:text-md font-semibold uppercase tracking-wider text-white/80 fade-in fade-in-100">
            {pretitle}
          </p>

          {/* Headline with subtle emphasis on “machinery” */}
          <h1 className="mt-2 text-3xl md:text-4xl font-bold leading-tight text-white/90 fade-in fade-in-200">
            {title.includes("machinery") ? (
              <>
                {title.split("machinery")[0]}
                <span className="border-b border-accent text-white">machinery</span>
                {title.split("machinery")[1]}
              </>
            ) : (
              title
            )}
          </h1>

          {/* Subtitle */}
          <p className="mt-4 text-base md:text-lg text-white/80 fade-in fade-in-300">
            {subtitle}
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row fade-in fade-in-400">
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
