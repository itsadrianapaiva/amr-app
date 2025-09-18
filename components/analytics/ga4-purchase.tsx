"use client";

/**
 * Minimal GA4 "purchase" event sender.
 * Mount this on your Stripe success page after you load/confirm the booking.
 *
 * Usage:
 *   <Ga4Purchase
 *     transactionId={booking.id.toString()}
 *     value={Number(booking.totalCost)} // gross EUR amount incl. VAT
 *     currency="EUR"
 *     items={[{ item_id: String(booking.machineId), item_name: booking.machine.name }]}
 *   />
 */
import { useEffect } from "react";

type Item = {
  item_id: string;
  item_name?: string;
  quantity?: number;
  price?: number;
};

export default function Ga4Purchase(props: {
  transactionId: string;
  value: number;
  currency?: string;
  items?: Item[];
}) {
  const { transactionId, value, currency = "EUR", items = [] } = props;

  useEffect(() => {
    // Guard: require gtag and a valid value
    const gtag = (window as any)?.gtag as
      | ((...args: any[]) => void)
      | undefined;
    if (!gtag || !Number.isFinite(value)) return;

    // GA4 purchase event spec
    gtag("event", "purchase", {
      transaction_id: transactionId,
      value,
      currency,
      items,
    });
  }, [transactionId, value, currency, items]);

  return null;
}
