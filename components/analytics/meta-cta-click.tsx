"use client";

import { cloneElement, type ReactElement } from "react";
import { metaCtaClick } from "@/lib/analytics/metaEvents";

type MetaCtaClickProps = {
  ctaType: string;
  ctaText: string;
  ctaDestination: string;
  ctaLocation: string;
  children: ReactElement<{ onClick?: React.MouseEventHandler }>;
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
  const handleClick: React.MouseEventHandler = (e) => {
    // Fire Meta CTA event
    metaCtaClick({
      cta_type: ctaType,
      cta_text: ctaText,
      cta_destination: ctaDestination,
      cta_location: ctaLocation,
    });

    // Call original onClick if present
    if (typeof children.props.onClick === "function") {
      children.props.onClick(e);
    }
  };

  return cloneElement(children, { onClick: handleClick });
}
