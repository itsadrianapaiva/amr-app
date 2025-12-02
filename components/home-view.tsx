"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import Hero from "@/components/hero";
import CatalogSection from "@/components/catalog-section";
import { PromoModal } from "@/components/promo-modal";
import TrustLogosSection from "@/components/trust-logos-section";
import SocialProofSection from "@/components/social-proof-section";
// Split below-the-fold bundles:
const WhyBook = dynamic(() => import("./why-book"), { ssr: true });
const HowToBook = dynamic(() => import("./how-to-book"), { ssr: true });
const Faq = dynamic(() => import("./faq"), { ssr: true });
const ContactSection = dynamic(() => import("./contact-section"), {
  ssr: true,
});

import { HOME_HERO } from "@/lib/content/home";
import type { SerializableMachine } from "@/lib/types";
import DeferredScroll from "./nav/deferred-scroll";

interface HomeViewProps {
  machines: SerializableMachine[];
}
/** Small wrapper that mounts children only when near the viewport. */
function LazySection({
  children,
  minHeight = 400, // reserve space to avoid CLS
  rootMargin = "200px",
}: {
  children: React.ReactNode;
  minHeight?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || visible) return;
    const el = ref.current;

    // If IntersectionObserver is not supported, render immediately.
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div
      ref={ref}
      style={visible ? undefined : { minHeight }}
      aria-busy={!visible}
    >
      {visible ? children : null}
    </div>
  );
}

/** Always-present, zero-height anchor so in-page scrolling works with lazy sections. */
function SectionAnchor({ id }: { id: string }) {
  return (
    <div
      id={id}
      data-section={id}
      aria-hidden="true"
      // Optional: if you switch to native anchor scrolling, scroll-margin helps.
      // className="scroll-mt-28"
    />
  );
}

/**
 * HomeView
 * Composition-only wrapper: each UI section lives in its own component.
 */
export function HomeView({ machines }: HomeViewProps) {
  return (
    <main>
      {/* Promo modal — first-visit promotion */}
      <PromoModal />

      <DeferredScroll />

      {/* Section: Hero (LCP target, kept eager) */}
      <Hero {...HOME_HERO} />

      {/* Section: Catalog (near fold; keep eager for UX/SEO) */}
      <CatalogSection machines={machines} />

      {/* ---- Lazy sections need static anchors to enable reliable in-page scroll ---- */}

      {/* Anchor for "about" BEFORE the lazy chunk */}
      <SectionAnchor id="about" />
      {/* Section: Why book — lazy mount with reserved space */}
      <LazySection minHeight={420}>
        <WhyBook />
      </LazySection>

      {/* Section: Social proof — customer reviews and job site photos */}
      <SocialProofSection />
      {/* Section: Trust logos (payments and invoicing) */}
      <TrustLogosSection />

      {/* Anchor for "how-to-book" BEFORE the lazy chunk */}
      <SectionAnchor id="how-to-book" />
      {/* Section: How to Book — lazy mount with reserved space */}
      <LazySection minHeight={520}>
        <HowToBook />
      </LazySection>

      {/* Anchor for "faq" BEFORE the lazy chunk */}
      <SectionAnchor id="faq" />
      {/* Section: FAQ — lazy mount; SSR still enabled so content is indexable */}
      <LazySection minHeight={520}>
        <Faq />
      </LazySection>

      {/* Anchor for "contact" BEFORE the lazy chunk */}
      <SectionAnchor id="contact" />
      {/* Section: Contact — lazy */}
      <LazySection minHeight={460}>
        <ContactSection />
      </LazySection>
    </main>
  );
}
