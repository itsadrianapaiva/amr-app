"use client";

import { useEffect, useState } from "react";
import SafeImage from "@/components/safe-image";
import { SOCIAL_PROOF } from "@/lib/content/social-proof";
import { SOCIAL_PROOF_IMAGES } from "@/lib/content/social-proof-images";
import { SOCIAL_PROOF_REVIEWS } from "@/lib/content/social-proof-reviews";
import { cn } from "@/lib/utils";

export default function SocialProofSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    // Auto-rotate images and reviews every 6 seconds
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SOCIAL_PROOF_IMAGES.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const currentImage = SOCIAL_PROOF_IMAGES[currentIndex];
  const currentReview =
    SOCIAL_PROOF_REVIEWS.length > 0
      ? SOCIAL_PROOF_REVIEWS[currentIndex % SOCIAL_PROOF_REVIEWS.length]
      : {
          id: "fallback",
          quote: SOCIAL_PROOF.featuredReview.quote,
          author: SOCIAL_PROOF.featuredReview.author,
          location: SOCIAL_PROOF.featuredReview.location,
          stars: SOCIAL_PROOF.featuredReview.stars,
          contextLabel: SOCIAL_PROOF.featuredReview.contextLabel,
        };

  return (
    <section
      className="px-8 py-16 md:py-24 md:px-8 lg:px-12"
      aria-label="Real customer reviews and job site photos"
    >
      <div className="container mx-auto">
        <div className="relative">
          <div className="flex flex-col items-stretch gap-10 xl:flex-row xl:items-center xl:gap-0">
            {/* Left column: Review card with overlap on large screens */}
            <div className="flex-1 max-w-xl xl:-mr-20 xl:z-10">
              <div className="rounded-2xl bg-muted px-6 py-6 md:px-8 md:py-8 shadow-lg">
              {/* Pretitle */}
              <p className="text-xs font-semibold uppercase tracking-[1.4px] text-muted-foreground">
                {SOCIAL_PROOF.pretitle} · {SOCIAL_PROOF.sourceLabel}
              </p>

              {/* Title */}
              <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                {SOCIAL_PROOF.title}
              </h2>

              {/* Rating line with stars */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex gap-0.5" aria-label={SOCIAL_PROOF.ratingLabel}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className="h-4 w-4 fill-yellow-500"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm font-medium">
                  {SOCIAL_PROOF.ratingLabel} · {SOCIAL_PROOF.reviewCount}+ reviews
                </p>
              </div>

              {/* Featured quote */}
              <p
                className="mt-4 text-sm text-muted-foreground leading-relaxed"
                aria-live="polite"
              >
                &ldquo;{currentReview.quote}&rdquo;
              </p>

              {/* Author line */}
              <p className="mt-3 text-sm font-medium">
                {currentReview.author} · {currentReview.location}
              </p>

              {/* Context label */}
              <p className="text-xs text-muted-foreground">
                {currentReview.contextLabel}
              </p>

              {/* CTA link */}
              <a
                href={SOCIAL_PROOF.ctaHref}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-5 inline-flex text-sm font-semibold underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                {SOCIAL_PROOF.ctaLabel}
              </a>
            </div>
          </div>

            {/* Right column: Image carousel with fixed height */}
            <div className="flex-1">
              <div className="relative overflow-hidden rounded-2xl bg-muted h-[260px] md:h-[440px] xl:h-[480px] shadow-md">
                <SafeImage
                  src={currentImage.src}
                  alt={currentImage.alt}
                  width={900}
                  height={600}
                  sizes="(min-width:1280px) 640px, (min-width:768px) 80vw, 100vw"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Dot indicators */}
              <div className="mt-3 flex justify-center gap-2">
                {SOCIAL_PROOF_IMAGES.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    aria-label={`View slide ${index + 1} of ${SOCIAL_PROOF_IMAGES.length}`}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      index === currentIndex
                        ? "bg-muted-foreground"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
