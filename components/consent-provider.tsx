"use client";

/**
 * ConsentProvider wires Google Consent Mode v2 + gtag for GA4 / Google Ads.
 * It starts with "denied" for ads & analytics, then upgrades based on your cookie.
 *
 * ENV (public at build/runtime):
 * - NEXT_PUBLIC_GA4_ID   e.g., "G-XXXXXXXXXX"     (optional)
 * - NEXT_PUBLIC_GADS_ID  e.g., "AW-XXXXXXXXXX"    (optional)
 *
 * Cookie contract:
 * - Name: "amr_consent"
 * - JSON payload example: {"analytics":true,"ads":false}
 * - If your CookieConsentBanner can, dispatch a window event:
 *     window.dispatchEvent(new CustomEvent("amr:consent", { detail: { analytics:true, ads:false } }))
 *   This component listens for that and updates Consent Mode live.
 */

import { useEffect, useRef } from "react";

type ConsentState = { analytics?: boolean; ads?: boolean };

function readConsentFromCookie(): ConsentState {
  try {
    const m = document.cookie.match(/(?:^|;\s*)amr_consent=([^;]+)/);
    if (!m) return {};
    return JSON.parse(decodeURIComponent(m[1])) as ConsentState;
  } catch {
    return {};
  }
}

function applyConsent(consent: ConsentState) {
  // Initialize dataLayer/gtag stub if missing
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }

  // 🔎 DEBUG
  console.log("🔎 [Consent] applyConsent()", { consent });

  // Start conservative (denied) then upgrade if consented
  gtag("consent", "default", {
    ad_user_data: "denied",
    ad_personalization: "denied",
    ad_storage: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  });

  const updates: Record<string, "granted" | "denied"> = {};
  if (consent.analytics) updates.analytics_storage = "granted";
  if (consent.ads) {
    updates.ad_user_data = "granted";
    updates.ad_personalization = "granted";
    updates.ad_storage = "granted";
  }
  if (Object.keys(updates).length) {
    // 🔎 DEBUG
    console.log("🔎 [Consent] consent update", updates);
    gtag("consent", "update", updates);
  }
}

function ensureGtagLoaded(ga4Id?: string, gadsId?: string) {
  // Only load once
  if ((window as any).__amr_gtag_loaded) return;
  (window as any).__amr_gtag_loaded = true;

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }
  (window as any).gtag = gtag;

  // Load the library using the first available id (GA4 preferred)
  const firstId = ga4Id || gadsId;
  if (!firstId) {
    // 🔎 DEBUG
    console.warn("🔎 [Consent] No GA4 or GADS ID present. Skipping gtag load.");
    return;
  }
  // 🔎 DEBUG
  console.log("🔎 [Consent] ensureGtagLoaded()", { ga4Id, gadsId, firstId });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(firstId)}`;
  document.head.appendChild(s);

  gtag("js", new Date());

  // Configure each id present. Use send_page_view false if you later do manual pageview tracking.
  if (ga4Id) {
    // 🔎 DEBUG
    console.log("🔎 [Consent] gtag config GA4", ga4Id);
    gtag("config", ga4Id, { send_page_view: true });
  }
  if (gadsId) {
    // 🔎 DEBUG
    console.log("🔎 [Consent] gtag config GADS", gadsId);
    gtag("config", gadsId);
  }
}

export default function ConsentProvider() {
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const ga4 = process.env.NEXT_PUBLIC_GA4_ID;
    const gads = process.env.NEXT_PUBLIC_GADS_ID;

    // 🔎 DEBUG
    console.log("🔎 [Consent] boot", { ga4, gads });

    // 1) Apply current consent (cookie or empty → defaults to denied)
    const consent = readConsentFromCookie();
    applyConsent(consent);

    // 2) Load gtag library/configs (if any IDs present)
    ensureGtagLoaded(ga4, gads);

    // 3) Listen for consent updates broadcast by your banner
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail || {};
      applyConsent(detail);
    };
    window.addEventListener("amr:consent", onUpdate as EventListener);

    return () =>
      window.removeEventListener("amr:consent", onUpdate as EventListener);
  }, []);

  return null;
}
