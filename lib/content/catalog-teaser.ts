/**
 * Catalog teaser content for homepage.
 * Defines thumbnail items that link to machine detail pages.
 */

export type CatalogTeaserItem = {
  /** Unique identifier for the teaser item. */
  id: string;
  /** Display label (EN) shown next to the thumbnail. */
  label: string;
  /** Key to look up the image in imageContent.machines. */
  imageKey: string;
  /** Direct href (all cards link to /catalog). */
  href: string;
};

/**
 * Curated set of four top-level categories (Excavators, Skid steers, Telehandlers,
 * Small construction equipment) for the homepage catalog teaser.
 */
export const CATALOG_TEASER_ITEMS: CatalogTeaserItem[] = [
  {
    id: "excavators",
    label: "Excavators",
    imageKey: "medium-excavator",
    href: "/catalog",
  },
  {
    id: "skid-steers",
    label: "Skid steers",
    imageKey: "wheel-skid-steer-loader",
    href: "/catalog",
  },
  {
    id: "telehandlers",
    label: "Telehandlers",
    imageKey: "telehandler",
    href: "/catalog",
  },
  {
    id: "small-construction-equipment",
    label: "Small construction equipment",
    imageKey: "compactor",
    href: "/catalog",
  },
];

/** CTA button label at the bottom of the teaser section. */
export const CATALOG_TEASER_CTA = "See Full Catalog";
