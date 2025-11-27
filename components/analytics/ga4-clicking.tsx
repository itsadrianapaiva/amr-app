"use client";

import { isGaDebug, waitForGtag } from "@/lib/analytics";
import React, { useRef, useCallback, cloneElement } from "react";

type Ga4ClickProps = {
  event: string;
  params?: Record<string, unknown>;
  once?: boolean;
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
};

function readAnalyticsConsent(): boolean {
  try {
    const m = document.cookie.match(/(?:^|;\s*)amr_consent=([^;]+)/);
    if (!m) return false;
    const obj = JSON.parse(decodeURIComponent(m[1])) as { analytics?: boolean };
    return !!obj.analytics;
  } catch {
    return false;
  }
}

export default function Ga4Click({
  event,
  params = {},
  once = true,
  children,
}: Ga4ClickProps) {
  const sentRef = useRef(false);

  const handleClick: React.MouseEventHandler = useCallback(
    async (e) => {
      if (typeof children.props.onClick === "function") {
        children.props.onClick(e);
      }

      if (once && sentRef.current) return;

      if (!readAnalyticsConsent()) {
        console.log("🔎 Ga4Click: blocked by consent", { event, params });
        return;
      }

      const gtag = await waitForGtag();
      if (!gtag) {
        console.log("🔎 Ga4Click: gtag not ready", { event, params });
        return;
      }

      const payload = { ...params, debug_mode: isGaDebug() };
      gtag("event", event, payload);

      sentRef.current = true;
      console.log("🔎 Ga4Click fired", { event, params });
    },
    [children, event, JSON.stringify(params), once]
  );

  return cloneElement(children, { onClick: handleClick });
}

/**
 * Generic helper to fire GA4 click events with consent checks
 * @param event - GA4 event name
 * @param params - Optional event parameters
 */
export async function trackGaClick(
  event: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  if (!readAnalyticsConsent()) {
    if (isGaDebug()) {
      console.log("🔎 trackGaClick: blocked by consent", { event, params });
    }
    return;
  }

  const gtag = await waitForGtag();
  if (!gtag) {
    if (isGaDebug()) {
      console.log("🔎 trackGaClick: gtag not ready", { event, params });
    }
    return;
  }

  const payload = { ...params, debug_mode: isGaDebug() };
  gtag("event", event, payload);

  if (isGaDebug()) {
    console.log("🔎 trackGaClick fired", { event, payload });
  }
}

/**
 * Hero primary CTA click (e.g., "Browse machines")
 */
export function trackGaHeroPrimaryCtaClick(params: {
  cta_text: string;
  cta_destination: string;
}): void {
  trackGaClick("hero_primary_cta_click", params);
}

/**
 * Hero secondary CTA click (e.g., WhatsApp button)
 */
export function trackGaHeroSecondaryCtaClick(params: {
  cta_text: string;
  cta_destination: string;
}): void {
  trackGaClick("hero_secondary_cta_click", params);
}

/**
 * Catalog navigation click from nav or footer
 */
export function trackGaCatalogNavClick(params: {
  link_text: string;
  link_location: "nav" | "footer";
}): void {
  trackGaClick("catalog_nav_click", params);
}

/**
 * Machine card CTA click
 */
export function trackGaMachineCardClick(params: {
  machine_id: number;
  machine_name: string;
  machine_category?: string;
}): void {
  trackGaClick("machine_card_click", params);
}

/**
 * Contact CTA click (WhatsApp, phone, email)
 */
export function trackGaContactCtaClick(params: {
  contact_method: "whatsapp" | "phone" | "email";
  cta_location: "hero" | "contact_section" | "footer" | "nav";
  cta_text?: string;
}): void {
  trackGaClick("contact_cta_click", params);
}
