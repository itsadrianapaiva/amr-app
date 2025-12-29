import "server-only";
import { cache } from "react";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * getFooterCategories
 * Server-only, cached list of **friendly** category labels
 * that actually exist in inventory.
 */
export const getFooterCategories = cache(async (): Promise<string[]> => {
  const prisma = db;

  // rows: { category: string | null }[]
  const rows = await prisma.machine.findMany({
    select: { category: true },
    distinct: [Prisma.MachineScalarFieldEnum.category],
    orderBy: { category: "asc" },
  });

  const labelsSet = new Set<string>();
  for (const row of rows) {
    // Reuse existing display mapper; tolerate nulls
    const label = MACHINE_CARD_COPY.displayType(String(row.category ?? ""));
    if (label) labelsSet.add(label);
  }

  return Array.from(labelsSet).sort((a, b) => a.localeCompare(b));
});
