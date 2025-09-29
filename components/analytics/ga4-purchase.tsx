"use client";

import { useEffect, useRef } from "react";

type Item = {
  item_id: string;
  item_name?: string;
  quantity?: number;
  price?: number;
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

function waitForGtag(maxMs = 5000): Promise<((...a: any[]) => void) | null> {
  return new Promise((resolve) => {
    const g = (window as any).gtag as ((...a: any[]) => void) | undefined;
    if (g) return resolve(g);
    const started = Date.now();
    const iv = setInterval(() => {
      const gg = (window as any).gtag as ((...a: any[]) => void) | undefined;
      if (gg) {
        clearInterval(iv);
        resolve(gg);
      } else if (Date.now() - started > maxMs) {
        clearInterval(iv);
        resolve(null);
      }
    }, 200);
  });
}

export default function Ga4Purchase(props: {
  transactionId: string;
  value: number;
  currency?: string;
  items?: Item[];
}) {
  const { transactionId, value, currency = "EUR", items = [] } = props;
  const sentRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Number.isFinite(value)) return;

    const fire = async () => {
      if (sentRef.current) return;
      const gtag = await waitForGtag();
      if (!gtag) return; // gtag never loaded (ID missing) → noop
      gtag("event", "purchase", {
        transaction_id: transactionId,
        value,
        currency,
        items,
      });
      sentRef.current = true;
    };

    // If analytics already granted → send now; else wait for banner update
    if (readAnalyticsConsent()) {
      void fire();
    } else {
      const onConsent = (e: Event) => {
        const detail = (e as CustomEvent<{ analytics?: boolean }>).detail || {};
        if (detail.analytics) {
          void fire();
          window.removeEventListener("amr:consent", onConsent as EventListener);
        }
      };
      window.addEventListener("amr:consent", onConsent as EventListener);
      return () =>
        window.removeEventListener("amr:consent", onConsent as EventListener);
    }
  }, [transactionId, value, currency, JSON.stringify(items)]);

  return null;
}
