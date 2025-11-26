"use client";
import { isGaDebug, waitForGtag } from "@/lib/analytics";
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
    if (!Number.isFinite(value)) {
      if (isGaDebug()) {
        console.log("🔎 Ga4Purchase: invalid value", { transactionId, value });
      }
      return;
    }

    // SessionStorage-based idempotency guard to prevent duplicate events on reload
    const storageKey = `amr_ga4_purchase_${transactionId}`;
    try {
      if (typeof sessionStorage !== "undefined") {
        if (sessionStorage.getItem(storageKey)) {
          if (isGaDebug()) {
            console.log("🔎 Ga4Purchase: already fired this session", {
              transactionId,
            });
          }
          return;
        }
      }
    } catch {
      // Ignore storage access errors
    }

    console.log("🔎 Ga4Purchase mount", {
      transactionId,
      value,
      currency,
      analyticsGranted: readAnalyticsConsent(),
      hasGtag: typeof (window as any).gtag === "function",
      debugMode: isGaDebug(),
    });

    const fire = async () => {
      if (sentRef.current) return;

      const gtag = await waitForGtag();
      if (!gtag) {
        if (isGaDebug()) {
          console.log("🔎 Ga4Purchase: gtag not available", { transactionId });
        }
        return;
      }

      gtag("event", "purchase", {
        transaction_id: transactionId,
        value,
        currency,
        items,
        debug_mode: isGaDebug(),
      });

      sentRef.current = true;

      // Store flag to prevent duplicates on reload
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(storageKey, "1");
        }
      } catch {
        // Ignore storage errors
      }

      console.log("🔎 Ga4Purchase fired", { transactionId, value });
    };

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
