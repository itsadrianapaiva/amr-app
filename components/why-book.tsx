import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import Pretitle from "@/components/ui/pretitle";
import { WHY_BOOK } from "@/lib/content/why";
import { imageContent } from "@/lib/content/images";
import { CheckCircle2 } from "lucide-react";

/**
 * WhyBook
 * Spacing & headings normalized to your MachineDetailPage pattern:
 * - Section: px-4/8/12 + py-16/24
 * - Headings: explicit text sizes (no .h2)
 */
export default function WhyBook() {
  // Pick which variant to show: "default" or "alt"
  const img = imageContent.why.default;

  // Detect static import to enable blur placeholder
  const isStatic =
    typeof img.src === "object" &&
    img.src !== null &&
    "src" in (img.src as StaticImageData);

  return (
    <section id="about" className="px-8 py-16 md:py-24 md:px-8 lg:px-12">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-12 xl:flex-row xl:gap-12">
          {/* Left: text/content */}
          <div className="flex-1">
            <div className="max-w-[560px]">
              <Pretitle text={WHY_BOOK.pretitle} />
              <h2 className="my-6 text-3xl font-bold tracking-tight md:text-4xl">
                {WHY_BOOK.title}
              </h2>
              <p className="mb-8 text-muted-foreground">{WHY_BOOK.paragraph}</p>

              {/* Value props */}
              <ul className="mb-8 grid gap-4">
                {WHY_BOOK.points.map((p) => (
                  <li key={p.title} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" />
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={WHY_BOOK.cta.href}
                className="inline-flex rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {WHY_BOOK.cta.label}
              </Link>
            </div>
          </div>

          {/* Right: image */}
          <div className="flex-1 xl:flex xl:justify-center">
            <div className="relative">
              {/* Accent bg block behind image (desktop only) */}
              <div className="absolute -left-4 -top-4 -z-10 hidden h-[600px] w-[420px] bg-primary/50 xl:block" />
              <Image
                src={img.src}
                alt={img.alt}
                width={444}
                height={492}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                /* Right column is ~420–444px on xl. Below xl it can span ~90vw. */
                sizes="(min-width:1280px) 444px, (min-width:1024px) 50vw, 90vw"
                /* Blur when using StaticImageData from our static imports */
                placeholder={isStatic ? "blur" : "empty"}
                quality={78}
                className="block"
                style={{ width: "auto", height: "auto" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
