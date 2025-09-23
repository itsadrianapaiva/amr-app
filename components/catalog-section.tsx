"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Pretitle from "@/components/ui/pretitle";
import { MachineCard } from "@/components/machine-card";
import type { SerializableMachine } from "@/lib/types";
import { HOME_INVENTORY } from "@/lib/content/home";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";
import { toTitleCase } from "@/lib/utils";

type CatalogSectionProps = {
  machines: SerializableMachine[];
};

/** Safe string read from an object without using `any`. */
function readStr(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const v = obj[key];
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : undefined;
}

/** Build a human label from category/type using a friendly map, falling back to Title Case. */
function labelFor(m: SerializableMachine): string {
  const o = m as unknown as Record<string, unknown>;
  const raw = readStr(o, "category") ?? readStr(o, "type") ?? "";
  const friendly = MACHINE_CARD_COPY.displayType(raw);
  return friendly && friendly.length ? friendly : raw ? toTitleCase(raw) : "";
}

/** Determine how many cards fit per row using Tailwind breakpoints. */
function useCardsPerRow() {
  const [cols, setCols] = useState<number>(1); // default: base (1 col)

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      // Tailwind breakpoints: md=768, xl=1280 → our grid is 1 / 2 / 4
      if (w >= 1280) setCols(4);
      else if (w >= 768) setCols(2);
      else setCols(1);
    };
    compute();
    window.addEventListener("resize", compute, { passive: true });
    return () => window.removeEventListener("resize", compute);
  }, []);

  return cols;
}

/** CatalogSection: intro text, category pills, and machine grid. */
export default function CatalogSection({ machines }: CatalogSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const cardsPerRow = useCardsPerRow();

  // Unique, sorted categories built from labels
  const categories = useMemo(() => {
    const labels = new Set<string>();
    for (const m of machines) {
      const label = labelFor(m);
      if (label) labels.add(label);
    }
    return ["All", ...Array.from(labels).sort((a, b) => a.localeCompare(b))];
  }, [machines]);

  // Filter list by selected category
  const visibleMachines = useMemo(() => {
    if (selectedCategory === "All") return machines;
    return machines.filter((m) => labelFor(m) === selectedCategory);
  }, [machines, selectedCategory]);

  // URL sync
  const didInitFromURL = useRef(false);

  // URL -> State (only once, after categories exist)
  useEffect(() => {
    if (didInitFromURL.current) return;
    const url = new URL(window.location.href);
    const qp = url.searchParams.get("category");
    if (qp) {
      const match = categories.find(
        (c) => c.toLowerCase() === qp.toLowerCase()
      );
      if (match) setSelectedCategory(match);
    }
    didInitFromURL.current = true;
  }, [categories]);

  // State -> URL (only when value actually changes)
  useEffect(() => {
    const url = new URL(window.location.href);
    const current = url.searchParams.get("category");
    const desired = selectedCategory === "All" ? null : selectedCategory;
    if (current === desired) return;
    if (desired === null) url.searchParams.delete("category");
    else url.searchParams.set("category", desired);
    const newUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", newUrl);
  }, [selectedCategory]);

  // Number of eager images should equal the first visual row (1 / 2 / 4)
  const eagerCount = cardsPerRow;

  return (
    <section id="catalog" className="container mx-auto">
      {/* Inventory intro */}
      <div className="py-18 text-center md:py-20 xl:py-22">
        <Pretitle text={HOME_INVENTORY.pretitle} center />
        <h2 className="my-6 text-3xl font-bold tracking-tight md:text-4xl">
          {HOME_INVENTORY.title}
        </h2>
        <p className="mx-auto max-w-xl text-muted-foreground">
          {HOME_INVENTORY.subtitle}
        </p>
      </div>

      {/* Category filter */}
      <div className="mb-6 w-full">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 py-1 sm:gap-3">
          {categories.map((cat) => {
            const selected = cat === selectedCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selected}
                className={[
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-surface/20",
                ].join(" ")}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {visibleMachines.map((machine, idx) => (
          <MachineCard
            key={machine.id}
            machine={machine}
            eager={idx < eagerCount}
          />
        ))}
      </div>
    </section>
  );
}
