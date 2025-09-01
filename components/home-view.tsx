"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MachineCard } from "@/components/machine-card";
import Pretitle from "@/components/ui/pretitle";
import type { SerializableMachine } from "@/lib/types";
import Hero from "@/components/hero";
import { HOME_HERO, HOME_INVENTORY } from "@/lib/content/home";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";

interface HomeViewProps {
  machines: SerializableMachine[];
}

export function HomeView({ machines }: HomeViewProps) {
  const [headerActive, setHeaderActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    const handleScroll = () => setHeaderActive(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Build unique categories from the *friendly* display label (collapses CSV synonyms)
  const categories = useMemo(() => {
    const labels = new Set<string>();
    for (const m of machines) {
      labels.add(MACHINE_CARD_COPY.displayType(m.type));
    }
    return ["All", ...Array.from(labels).sort((a, b) => a.localeCompare(b))];
  }, [machines]);

  // Filter using the *friendly* label so pills and grid stay consistent
  const visibleMachines = useMemo(() => {
    if (selectedCategory === "All") return machines;
    return machines.filter(
      (m) => MACHINE_CARD_COPY.displayType(m.type) === selectedCategory
    );
  }, [machines, selectedCategory]);

  // URL SYNC (stable)
  const didInitFromURL = useRef(false);

  // URL -> State (init once, after categories exist)
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

  // State -> URL (only write when changed)
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

  return (
    <main className="px-4 md:px-8 lg:px-12">
      {/* HERO — small, conversion-first */}
      <Hero {...HOME_HERO} />

      {/* Inventory header fed by content lib */}
      <section className="container mx-auto py-10 text-center md:py-14 xl:py-16">
        <Pretitle text={HOME_INVENTORY.pretitle} center />
        <h2 className="my-3 text-3xl font-bold tracking-tight md:text-4xl">
          {HOME_INVENTORY.title}
        </h2>
        <p className="mx-auto max-w-xl text-muted-foreground">
          {HOME_INVENTORY.subtitle}
        </p>
      </section>

      {/* Category filter + grid */}
      <section id="catalog" className="container mx-auto">
        <div className="mb-6 w-full">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 sm:gap-3 py-1">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {visibleMachines.map((machine) => (
            <MachineCard key={machine.id} machine={machine} />
          ))}
        </div>
      </section>

      {/* Future sections: About, FAQ, Legal, Contacts */}
    </main>
  );
}
