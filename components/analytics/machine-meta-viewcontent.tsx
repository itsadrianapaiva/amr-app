"use client";

import { useEffect, useRef } from "react";
import { metaViewContent } from "@/lib/analytics/metaEvents";

type Props = {
  machineId: number;
  machineName: string;
  category: string;
  dailyRate: number;
};

/**
 * Client component that fires Meta ViewContent event once per machine view
 * Safe to call - handles missing fbq gracefully via metaViewContent
 */
export default function MachineMetaViewContent(props: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    metaViewContent({
      machineId: props.machineId,
      machineName: props.machineName,
      category: props.category,
      dailyRate: props.dailyRate,
    });
  }, [props.machineId, props.machineName, props.category, props.dailyRate]);

  return null;
}
