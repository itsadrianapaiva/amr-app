// File: components/home-view.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { MachineCard } from "@/components/machine-card";
import Pretitle from "@/components/ui/pretitle";
import type { SerializableMachine } from "@/lib/types";
import Hero from "@/components/hero";
import { HOME_HERO } from "@/lib/content/home";

interface HomeViewProps {
  machines: SerializableMachine[];
}

export function HomeView({ machines }: HomeViewProps) {
  const [headerActive, setHeaderActive] = useState(false);

  // Selected category for filtering — "All" shows everything.
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    const handleScroll = () => setHeaderActive(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Derive unique categories from data at runtime (no hardcoding).
  const categories = useMemo(() => {
    const set = new Set<string>();
    machines.forEach((m) => set.add(m.type || "Uncategorized"));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [machines]);

  // Filter machines by selected category (client-side only).
  const visibleMachines = useMemo(() => {
    if (selectedCategory === "All") return machines;
    return machines.filter(
      (m) => (m.type || "Uncategorized") === selectedCategory
    );
  }, [machines, selectedCategory]);

  return (
    <main className="px-4 md:px-8 lg:px-12">
      {/* HERO — small, conversion-first, consumes centralized copy */}
      <Hero {...HOME_HERO} />

      {/* Inventory header (secondary to Hero). Keep SEO structure sane (one H1 overall). */}
      <section className="container mx-auto py-10 text-center md:py-14 xl:py-16">
        <Pretitle text="Our Inventory" center />
        <h2 className="my-3 text-3xl font-bold tracking-tight md:text-4xl">
          Machinery for Rent
        </h2>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Explore robust, reliable machines — book online in minutes with
          deposit checkout.
        </p>
      </section>

      {/* Category filter + grid wrapper — anchor target for primary CTA */}
      <section id="catalog" className="container mx-auto">
        {/* Category pills: wrap and center (no horizontal overflow) */}
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

        {/* Machine Grid */}
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
