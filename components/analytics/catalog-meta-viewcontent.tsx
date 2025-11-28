"use client";

import { useEffect, useRef } from "react";
import type { SerializableMachine } from "@/lib/types";
import { metaCatalogViewContent } from "@/lib/analytics/metaEvents";

type Props = {
  machines: SerializableMachine[];
};

/**
 * CatalogMetaViewContent
 * Fires a single Meta ViewContent event when the catalog page is viewed
 * Represents the catalog as a product group with all machine IDs
 */
export default function CatalogMetaViewContent({ machines }: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const contentIds = machines.map((m) => String(m.id));

    metaCatalogViewContent({
      contentIds,
      numItems: contentIds.length,
    });
  }, [machines]);

  return null;
}
