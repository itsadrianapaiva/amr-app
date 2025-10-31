import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ScrollLink from "@/components/nav/scroll-link";

/* PERF-TUNING v2025-10-31: Use optimized WebP versions for faster LCP */
/* Static imports unlock intrinsic size + blur + preload for priority */
import hero01 from "@/public/images/hero/hero.webp";
import hero02 from "@/public/images/hero/hero-02.webp";
import hero03 from "@/public/images/hero/hero-03.webp";

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

const HERO_IMAGES: Record<
  NonNullable<HeroProps["imageName"]>,
  StaticImageData
> = {
  hero: hero01,
  "hero-02": hero02,
  "hero-03": hero03,
};

/** Build a WhatsApp deep link from E.164 (server-safe, no DOM API). */
function buildWhatsAppHref(e164?: string | null) {
  if (!e164) return null;
  const digits = e164.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function isSectionHref(href?: string) {
  if (!href) return false;
  return href.startsWith("#") || href.startsWith("/#");
}
function toSectionId(href?: string) {
  if (!href) return "";
  return href.replace("/#", "").replace("#", "");
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
        "relative min-h-[64vh] overflow-hidden",
        backgroundClassName,
      ].join(" ")}
    >
      {/* LCP: full-bleed background. One image, one priority. */}
      {/* PERF-TUNING v2025-10-31: Optimized sizes hint to prevent mobile from downloading desktop-size assets */}
      <Image
        src={heroImg}
        alt="Tracked excavator working on a job site"
        fill
        priority
        fetchPriority="high"
        /* PERF-TUNING v2025-10-31: Responsive sizes hint caps image width at breakpoints
         * Mobile gets ~375px, tablet ~768px, desktop caps at 1600px instead of full 1920px+ */
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1600px"
        /* PERF-TUNING v2025-10-31: Bumped quality to 80 for AVIF to maintain visual fidelity */
        quality={80}
        placeholder="blur"
        className="absolute inset-0 object-cover"
      />

      {/* keep overlay + text fades, but NOT on the h1 */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/10 via-black/70 to-black/90 fade-in fade-in-100" />

      <div className="container mx-auto flex min-h-[64vh] items-center px-4 md:px-8">
        <div className="z-20 mx-auto max-w-[608px] text-center text-white xl:mx-0 xl:text-left text-balance">
          <p className="text-sm md:text-md font-semibold uppercase tracking-wider text-white/80 fade-in fade-in-100">
            {pretitle}
          </p>

          {/* IMPORTANT: h1 has NO fade/transform so it can paint ASAP */}
          <h1 className="mt-2 text-3xl md:text-4xl font-bold leading-tight text-white/90">
            {title.includes("machinery") ? (
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

          <p className="mt-4 text-base md:text-lg text-white/80 fade-in fade-in-300">
            {subtitle}
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row fade-in fade-in-400">
            {isSectionHref(primaryHref) ? (
              // ScrollLink renders a <button>; to avoid button-in-button,
              // render the shadcn Button "asChild" so it becomes a <span>.
              <ScrollLink
                to={toSectionId(primaryHref)}
                offset={112}
                ariaLabel={primaryLabel}
              >
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  <span>{primaryLabel}</span>
                </Button>
              </ScrollLink>
            ) : (
              <Link href={primaryHref}>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  {primaryLabel}
                </Button>
              </Link>
            )}

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
