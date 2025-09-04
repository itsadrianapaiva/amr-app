import "server-only";
import { cache } from "react";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

// Lean row type for our query
type MachineCategoryRow = { category: string };

/**
 * Resolve a PrismaClient instance:
 * 1) Try whatever your "@/lib/db" exports (named/default/db/client).
 * 2) Fallback: create a local singleton (dev-safe via globalThis).
 */
async function resolvePrisma(): Promise<PrismaClient> {
  try {
    const mod: any = await import("@/lib/db");
    const candidate =
      mod?.prisma ?? mod?.default ?? mod?.db ?? mod?.client ?? null;

    if (
      candidate &&
      typeof candidate === "object" &&
      candidate.machine?.findMany
    ) {
      return candidate as PrismaClient;
    }
  } catch {
    // ignore and fallback below
  }

  const { PrismaClient } = await import("@prisma/client");
  const g = globalThis as unknown as { __amr_prisma?: PrismaClient };
  if (!g.__amr_prisma) {
    g.__amr_prisma = new PrismaClient();
  }
  return g.__amr_prisma;
}

/**
 * getFooterCategories
 * Server-only, cached list of **friendly** category labels
 * that actually exist in inventory.
 */
export const getFooterCategories = cache(async (): Promise<string[]> => {
  const prisma = await resolvePrisma();

  const categories = (await prisma.machine.findMany({
    select: { category: true },
    distinct: [Prisma.MachineScalarFieldEnum.category], // <-- Prisma 6 enum
    orderBy: { category: "asc" },
  })) as MachineCategoryRow[];

  const labelsSet = new Set<string>(
    categories
      // Reuse existing display mapper; it can accept category keys as before.
      .map((row: MachineCategoryRow) =>
        MACHINE_CARD_COPY.displayType(row.category)
      )
      .filter(Boolean)
  );

  const labels: string[] = Array.from(labelsSet).sort((a: string, b: string) =>
    a.localeCompare(b)
  );

  return labels;
});
