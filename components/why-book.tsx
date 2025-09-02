// components/why-book.tsx
import Link from "next/link";
import Image from "next/image";
import Pretitle from "@/components/ui/pretitle";
import { WHY_BOOK } from "@/lib/content/why";
import { CheckCircle2 } from "lucide-react";

/**
 * WhyBook
 * Spacing & headings normalized to your MachineDetailPage pattern:
 * - Section: px-4/8/12 + py-16/24
 * - Headings: explicit text sizes (no .h2)
 */
export default function WhyBook() {
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
                prefetch={false}
                className="inline-flex rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {WHY_BOOK.cta.label}
              </Link>
            </div>
          </div>

          {/* Right: image (optional). If none, show a balanced placeholder. */}
          <div className="flex-1 xl:flex xl:justify-center">
            <div className="relative">
              {/* Accent bg block behind image (desktop only) */}
              <div className="absolute -left-4 -top-4 -z-10 hidden h-[420px] w-[420px] bg-primary/50 xl:block" />
              {WHY_BOOK.image ? (
                <Image
                  src={WHY_BOOK.image.src}
                  alt={WHY_BOOK.image.alt}
                  width={WHY_BOOK.image.width ?? 444}
                  height={WHY_BOOK.image.height ?? 492}
                  loading="lazy"
                  className="block"
                />
              ) : (
                <div className="h-[360px] w-[360px] bg-muted xl:h-[420px] xl:w-[420px]" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
