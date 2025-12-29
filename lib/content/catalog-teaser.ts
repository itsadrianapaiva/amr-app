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
    href: "/catalog?category=Excavators",
  },
  {
    id: "skid-steers",
    label: "Skid Steers",
    imageKey: "wheel-skid-steer-loader",
    href: "/catalog?category=Skid+Steer+Loaders",
  },
  {
    id: "heavy-equipment",
    label: "Heavy Equipment",
    imageKey: "telehandler",
    href: "/catalog?category=Heavy+Equipment",
  },
  {
    id: "trucks-and-haulers",
    label: "Trucks and Haulers",
    imageKey: "volvo-dump-truck",
    href: "/catalog?category=Trucks+and+Haulers",
  },
  {
    id: "light-machinery",
    label: "Light Machinery",
    imageKey: "compactor",
    href: "/catalog?category=Light+Machinery+%26+Tools",
  },
  {
    id: "construction-tools",
    label: "Construction Tools",
    imageKey: "hole-boring-machine",
    href: "/catalog?category=Light+Machinery+%26+Tools",
  },
];

/** CTA button label at the bottom of the teaser section. */
export const CATALOG_TEASER_CTA = "See Full Catalog";
