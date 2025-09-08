"use client";

import Hero from "@/components/hero";
import CatalogSection from "@/components/catalog-section";
import WhyBook from "./why-book";
import Faq from "./faq";
import ContactSection from "./contact-section";
import { HOME_HERO } from "@/lib/content/home";
import type { SerializableMachine } from "@/lib/types";

interface HomeViewProps {
  machines: SerializableMachine[];
}

/**
 * HomeView
 * Composition-only wrapper: each UI section lives in its own component.
 */
export function HomeView({ machines }: HomeViewProps) {
  return (
    <main>
      {/* Section: Hero */}
      <Hero {...HOME_HERO} />

      {/* Section: Catalog (intro + pills + grid) */}
      <CatalogSection machines={machines} />

      {/* Section: Why book */}
      <WhyBook />

      {/* Section: FAQ */}
      <Faq />

      {/* Section: Contact */}
      <ContactSection />
    </main>
  );
}
