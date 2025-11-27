"use client";

import { cloneElement } from "react";
import type { MouseEvent, ReactElement } from "react";
import { metaCtaClick } from "@/lib/analytics/metaEvents";

type MetaCtaClickProps = {
  ctaType: string;
  ctaText: string;
  ctaDestination: string;
  ctaLocation: string;
  children: ReactElement<{ onClick?: (event: MouseEvent<any>) => void }>;
};

/**
 * MetaCtaClickWrapper
 * Client component wrapper that fires Meta CTA_Click event on click
 * while preserving existing onClick behavior.
 *
 * Usage:
 * <MetaCtaClickWrapper ctaType="..." ctaText="..." ctaDestination="..." ctaLocation="...">
 *   <Link href="...">Click me</Link>
 * </MetaCtaClickWrapper>
 */
export default function MetaCtaClickWrapper({
  ctaType,
  ctaText,
  ctaDestination,
  ctaLocation,
  children,
}: MetaCtaClickProps) {
  const originalOnClick = children.props.onClick;

  const handleClick = (event: MouseEvent<any>) => {
    // Call original onClick so navigation / ScrollLink logic still works
    if (typeof originalOnClick === "function") {
      originalOnClick(event);
    }

    // Fire Meta CTA event
    try {
      metaCtaClick({
        cta_type: ctaType,
        cta_text: ctaText,
        cta_destination: ctaDestination,
        cta_location: ctaLocation,
      });
    } catch {
      // Never break UX because of tracking
    }
  };

  return cloneElement(children, { onClick: handleClick });
}
