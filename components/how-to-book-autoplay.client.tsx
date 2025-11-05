"use client";

import { useEffect, useRef } from "react";

type HowToBookAutoplayProps = {
  videoEmbedSrc: string;
};

/**
 * Client Component that enables viewport-triggered autoplay for the Synthesia video.
 * Uses IntersectionObserver to load and start playback when section becomes visible.
 *
 * Note: Synthesia iframe may log ORB and sourcemap warnings; safe to ignore.
 * These are internal to Synthesia's CDN and do not affect functionality.
 */
export default function HowToBookAutoplay({
  videoEmbedSrc,
}: HowToBookAutoplayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When ≥50% visible, load video with autoplay + muted
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!iframe.src) {
              iframe.src = `${videoEmbedSrc}?autoplay=1&muted=1`;
            }
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% visible
      }
    );

    observer.observe(iframe);

    return () => {
      observer.disconnect();
    };
  }, [videoEmbedSrc]);

  return (
    <iframe
      ref={iframeRef}
      loading="lazy"
      title="Synthesia video player - Effortless Equipment Rental with AMR"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      className="absolute inset-0 h-full w-full border-0"
    />
  );
}
