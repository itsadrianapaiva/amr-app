"use client";

import { useEffect, useRef } from "react";
import type { SerializableMachine } from "@/lib/types";
import { trackGaCatalogViewItemList } from "@/components/analytics/ga4-clicking";

type Props = {
  machines: SerializableMachine[];
};

/**
 * CatalogGa4ViewList
 * Fires a single GA4 view_item_list event when the catalog page is viewed
 * Uses minimal payload with item_list_id and item_list_name only
 */
export default function CatalogGa4ViewList({ machines: _machines }: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    trackGaCatalogViewItemList({
      item_list_id: "main_catalog",
      item_list_name: "Main catalog",
    });
  }, []);

  return null;
}
