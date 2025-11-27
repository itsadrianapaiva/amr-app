"use client";

import Image from "next/image";
import Link from "next/link";
import Pretitle from "@/components/ui/pretitle";
import type { SerializableMachine } from "@/lib/types";
import { HOME_INVENTORY } from "@/lib/content/home";
import { imageContent } from "@/lib/content/images";
import {
  CATALOG_TEASER_ITEMS,
  CATALOG_TEASER_CTA,
} from "@/lib/content/catalog-teaser";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

type CatalogSectionProps = {
  /** Machines prop kept for API compatibility but not used in teaser. */
  machines: SerializableMachine[];
};

/**
 * CatalogSection: homepage teaser with thumbnail rows linking to machine detail pages.
 * Keeps id="catalog" for backward compatibility with /#catalog anchors.
 */
export default function CatalogSection({
  machines: _machines,
}: CatalogSectionProps) {
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

      {/* Teaser grid: two columns on desktop, single column on mobile */}
      <div className="mx-auto max-w-4xl mb-28">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {CATALOG_TEASER_ITEMS.map((item) => {
            const machineImage = imageContent.machines[item.imageKey];
            if (!machineImage) {
              console.warn(
                `Missing image for teaser item ${item.id} with key ${item.imageKey}`
              );
              return null;
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center gap-4 rounded-lg border border-border bg-surface/50 p-4 transition-all hover:border-primary hover:bg-surface/80"
              >
                {/* Thumbnail */}
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={machineImage.src}
                    alt={machineImage.alt}
                    fill
                    sizes="80px"
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                {/* Label */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary">
                    {item.label}
                  </h3>
                </div>

                {/* Arrow indicator */}
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </Link>
            );
          })}
        </div>

        {/* CTA button to full catalog */}
        <div className="mt-10 text-center">
          <Button asChild size="lg" className="px-8">
            <Link href="/catalog">
              {CATALOG_TEASER_CTA}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
