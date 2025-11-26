"use client";

import { useState } from "react";
import { isGaDebug, waitForGtag, logAnalyticsDebug } from "@/lib/analytics";
import {
  metaPageView,
  metaViewContent,
  metaInitiateCheckout,
  metaPurchase,
} from "@/lib/analytics/metaEvents";

export default function DebugEventsPanel() {
  const [feedback, setFeedback] = useState<string>("");
  const debugMode = isGaDebug();

  const showFeedback = (message: string) => {
    setFeedback(message);
    setTimeout(() => setFeedback(""), 3000);
  };

  // GA4 test handlers
  const handleGA4PageView = async () => {
    try {
      const gtag = await waitForGtag();
      if (!gtag) {
        showFeedback("GA4 not ready - gtag not available");
        return;
      }

      const payload = {
        page_location: typeof window !== "undefined" ? window.location.href : "",
        page_path: "/debug/events",
        page_title: "Debug Events Test Page",
        debug_mode: debugMode,
      };

      gtag("event", "page_view", payload);
      logAnalyticsDebug("GA4 test page_view fired", payload);
      showFeedback("✓ GA4 page_view sent");
    } catch (error) {
      console.error("Error firing GA4 page_view:", error);
      showFeedback("✗ Error firing GA4 page_view");
    }
  };

  const handleGA4Purchase = async () => {
    try {
      const gtag = await waitForGtag();
      if (!gtag) {
        showFeedback("GA4 not ready - gtag not available");
        return;
      }

      const payload = {
        transaction_id: "debug-order-1",
        value: 123.45,
        currency: "EUR",
        items: [
          {
            item_id: "debug-machine-1",
            item_name: "Debug Machine",
            quantity: 1,
            price: 123.45,
          },
        ],
        debug_mode: debugMode,
      };

      gtag("event", "purchase", payload);
      logAnalyticsDebug("GA4 test purchase fired", payload);
      showFeedback("✓ GA4 purchase sent");
    } catch (error) {
      console.error("Error firing GA4 purchase:", error);
      showFeedback("✗ Error firing GA4 purchase");
    }
  };

  // Meta test handlers
  const handleMetaPageView = () => {
    try {
      metaPageView({
        path: "/debug/events",
        title: "Debug Events Page",
      });
      showFeedback("✓ Meta PageView sent");
    } catch (error) {
      console.error("Error firing Meta PageView:", error);
      showFeedback("✗ Error firing Meta PageView");
    }
  };

  const handleMetaViewContent = () => {
    try {
      metaViewContent({
        machineId: 999,
        machineName: "Debug Skid Steer",
        category: "Test category",
        dailyRate: 150,
      });
      showFeedback("✓ Meta ViewContent sent");
    } catch (error) {
      console.error("Error firing Meta ViewContent:", error);
      showFeedback("✗ Error firing Meta ViewContent");
    }
  };

  const handleMetaInitiateCheckout = () => {
    try {
      metaInitiateCheckout({
        bookingId: 9999,
        machineId: 999,
        machineName: "Debug Skid Steer",
        estimatedValue: 300,
        currency: "EUR",
      });
      showFeedback("✓ Meta InitiateCheckout sent");
    } catch (error) {
      console.error("Error firing Meta InitiateCheckout:", error);
      showFeedback("✗ Error firing Meta InitiateCheckout");
    }
  };

  const handleMetaPurchase = () => {
    try {
      metaPurchase({
        bookingId: 9999,
        value: 300,
        currency: "EUR",
        machineId: 999,
        machineName: "Debug Skid Steer",
      });
      showFeedback("✓ Meta Purchase sent");
    } catch (error) {
      console.error("Error firing Meta Purchase:", error);
      showFeedback("✗ Error firing Meta Purchase");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="rounded-lg border border-yellow-400 bg-yellow-50 p-4">
        <h2 className="mb-2 text-lg font-semibold text-yellow-900">
          Debug Mode: {debugMode ? "Enabled" : "Disabled"}
        </h2>
        {!debugMode && (
          <p className="text-sm text-yellow-800">
            Add <code className="rounded bg-yellow-200 px-1">?debug_mode=1</code> to
            the URL to enable detailed console logging for all events.
          </p>
        )}
        {debugMode && (
          <p className="text-sm text-yellow-800">
            Check your browser console for detailed event payloads.
          </p>
        )}
      </div>

      {feedback && (
        <div className="rounded-lg border border-blue-400 bg-blue-50 p-3 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      {/* GA4 Events Group */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xl font-semibold">GA4 Test Events</h3>
        <p className="mb-4 text-sm text-gray-600">
          These events will appear in GA4 DebugView when sent from staging/local
          environments.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGA4PageView}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Fire GA4 test page_view
          </button>
          <button
            type="button"
            onClick={handleGA4Purchase}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Fire GA4 test purchase (€123.45)
          </button>
        </div>
      </div>

      {/* Meta Events Group */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xl font-semibold">Meta Pixel Test Events</h3>
        <p className="mb-4 text-sm text-gray-600">
          These events will appear in Meta Events Manager Test Events tool when
          sent from staging/local.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleMetaPageView}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Fire Meta test PageView
          </button>
          <button
            type="button"
            onClick={handleMetaViewContent}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Fire Meta test ViewContent
          </button>
          <button
            type="button"
            onClick={handleMetaInitiateCheckout}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Fire Meta test InitiateCheckout (€300)
          </button>
          <button
            type="button"
            onClick={handleMetaPurchase}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Fire Meta test Purchase (€300)
          </button>
        </div>
      </div>
    </div>
  );
}
