"use client";

import type { SocialLink } from "@/lib/content/social";

type SocialIconProps = {
  id: SocialLink["id"];
  className?: string;
};

export function SocialIcon({ id, className }: SocialIconProps) {
  if (id === "facebook") {
    // Simple FB logo inside a circle or square
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        focusable="false"
      >
        <path
          d="M22 12.07C22 6.52 17.52 2 12 2S2 6.52 2 12.07C2 17.1 5.66 21.29 10.44 22v-6.99H8.08v-2.94h2.36V9.82c0-2.33 1.4-3.62 3.53-3.62 1.02 0 2.09.18 2.09.18v2.3h-1.18c-1.16 0-1.52.73-1.52 1.47v1.77h2.59l-.41 2.94h-2.18V22C18.34 21.29 22 17.1 22 12.07Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (id === "instagram") {
    // Simple IG glyph
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        focusable="false"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="5"
          ry="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="17" cy="7" r="1.4" fill="currentColor" />
      </svg>
    );
  }

  return null;
}
