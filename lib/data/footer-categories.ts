import "server-only";
import { cache } from "react";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

// Safe runtime guard: checks object has `machine.findMany` like a PrismaClient
function isPrismaClient(x: unknown): x is PrismaClient {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  const machine = r["machine"];
  if (!machine || typeof machine !== "object") return false;
  const findMany = (machine as Record<string, unknown>)["findMany"];
  return typeof findMany === "function";
}

/**
 * Resolve a PrismaClient instance:
 * 1) Try whatever "@/lib/db" exports (named/default/db/client)
 * 2) Fallback: create a local singleton (dev-safe via globalThis)
 */
async function resolvePrisma(): Promise<PrismaClient> {
  try {
    const mod: unknown = await import("@/lib/db");
    if (mod && typeof mod === "object") {
      const m = mod as Record<string, unknown>;
      const candidates: unknown[] = [
        m["prisma"],
        m["default"],
        m["db"],
        m["client"],
      ];
      for (const c of candidates) {
        if (isPrismaClient(c)) return c;
      }
    }
  } catch {
    // ignore and fallback below
  }

  const { PrismaClient } = await import("@prisma/client");
  const g = globalThis as unknown as { __amr_prisma?: PrismaClient };
  if (!g.__amr_prisma) g.__amr_prisma = new PrismaClient();
  return g.__amr_prisma;
}

/**
 * getFooterCategories
 * Server-only, cached list of **friendly** category labels
 * that actually exist in inventory.
 */
export const getFooterCategories = cache(async (): Promise<string[]> => {
  const prisma = await resolvePrisma();

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
