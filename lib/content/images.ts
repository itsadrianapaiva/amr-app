import type { StaticImageData } from "next/image";

/** Accept either a static import or a public path string. */
export type ImgSrc = StaticImageData | string;

/** Optional focal hint for object-position tuning later. */
type Focal = "center" | "left" | "right" | "top" | "bottom";

/** Typed descriptors keep UI dumb and tiny. */
export interface HeroImage {
  src: ImgSrc;
  alt: string;
  focal?: Focal;
}

export interface WhyImage {
  src: ImgSrc;
  alt: string;
}

export interface MachineImage {
  src: ImgSrc;
  alt: string;
}
// Map CSV "Type"/Name slugs → your canonical machine-image keys
// Slugs derived from your CSV rows:
const MACHINE_IMAGE_ALIASES: Record<string, string> = {
  // CSV → canonical image key you already have in `imageContent.machines`
  "mini-bobcat-with-wheels": "wheel-skid-steer-loader",
  "mini-excavator": "mini-excavator",
  "medium-bobcat-skid-steer-w-tracks": "skid-steer-loader-tracks",
  "larger-bobcat-skid-steer-w-tracks": "lg-skid-steer-loader-tracks",
  "medium-excavator": "medium-excavator",
  "large-excavator": "large-excavator",
  telehandler: "telehandler",
  compactor: "compactor",
  "200-liter-concrete-mixer": "cement-mixer",
  "hyundai-petrol-powerwasher": "power-washer",
  // "large-eletric-hammer": <no exact image yet>  // will fall back until we add one
};

/** One place to change the global machine fallback path. */
const FALLBACK_MACHINE_IMAGE = "/images/machines/_fallback.jpg" as const;

/**
 * Centralized image content used across Hero, Why section, catalog cards,
 * and machine detail pages. Replace paths as you drop real files.
 */
export const imageContent = {
  /** Hero stays file-based for fast LCP and easy swaps (hero | hero-02 | hero-03). */
  hero: {
    src: "/images/hero/hero.jpg",
    alt: "Tracked excavator working on a job site at sunrise",
    focal: "center",
  } as HeroImage,

  /** Why section image variants (aka homepage visuals). */
  why: {
    default: {
      src: "/images/misc/homepage-02.jpg",
      alt: "Construction machinery operating on a sunny job site",
    },
    alt: {
      src: "/images/misc/homepage.jpg",
      alt: "Excavator and crew preparing a building site",
    },
  } satisfies Record<"default" | "alt", WhyImage>,

  /**
   * Machine images keyed by machine slug.
   * Your additional -02/-03 (WebP/JPEG) files are available for quick swaps later.
   */
  machines: {
    // Excavators
    "mini-excavator": {
      src: "/images/machines/mini-excavator.jpg",
      alt: "Mini excavator at a residential job site",
    },
    "medium-excavator": {
      src: "/images/machines/medium-excavator.jpg",
      alt: "Medium excavator working on a construction site",
    },
    "large-excavator": {
      src: "/images/machines/large-excavator.jpg",
      alt: "Large excavator moving earth at a work site",
    },

    // Skid steers (tracks and wheels)
    "skid-steer-loader-tracks": {
      src: "/images/machines/skid-steer-loader-tracks.jpg",
      alt: "Compact track loader (skid steer with rubber tracks)",
    },
    "lg-skid-steer-loader-tracks": {
      src: "/images/machines/lg-skid-steer-loader-tracks-02.jpg",
      alt: "Large compact track loader with rubber tracks",
    },
    "wheel-skid-steer-loader": {
      src: "/images/machines/wheel-skid-steer-loader.jpg",
      alt: "Wheeled skid steer loader on site",
    },

    // Lifting
    telehandler: {
      src: "/images/machines/telehandler.jpg",
      alt: "Telescopic handler lifting materials",
    },

    // Compaction
    compactor: {
      src: "/images/machines/compactor.jpg",
      alt: "Plate compactor for soil and base preparation",
    },

    // Concrete
    "cement-mixer": {
      src: "/images/machines/cement-mixer.jpg",
      alt: "Portable concrete mixer with drum",
    },

    // Cleaning
    "power-washer": {
      src: "/images/machines/power-washer.jpg",
      alt: "High-pressure power washer in outdoor use",
    },
  } as Record<string, MachineImage>,

  /** Expose fallback for diagnostics if needed. */
  fallback: {
    machine: FALLBACK_MACHINE_IMAGE,
  },
} as const;

/* - helpers (normalization)  */
// Normalize arbitrary names/enums to a slug-like key.
function toSlugLike(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Generates a few plausible keys to try against the machines map.
function candidateKeys(raw: string): string[] {
  const s = String(raw || "");
  const lower = s.toLowerCase();
  return [
    s,
    lower,
    lower.replace(/\s+/g, "-"),
    lower.replace(/_/g, "-"),
    toSlugLike(s),
  ].filter(Boolean);
}

/** Safe accessor that consults aliases and always returns a fallback. */
export function getMachineImage(slugOrType: string) {
  const map = imageContent.machines as Record<string, MachineImage | undefined>;

  // 1) Normalize the incoming type
  const normalized = toSlugLike(slugOrType);

  // 2) Translate CSV slug to your canonical key if we have an alias
  const canonical = MACHINE_IMAGE_ALIASES[normalized] ?? normalized;

  // 3) Try canonical first, then heuristic variants
  const tries = [canonical, ...candidateKeys(slugOrType)];
  for (const key of tries) {
    const hit = map[key];
    if (hit) return hit;
  }

  // 4) Graceful fallback
  return {
    src: imageContent.fallback.machine,
    alt: "Construction machinery on site",
  };
}

/**
 * Decide the best image for a machine by trying:
 *   1) type → alias → image map
 *   2) name → alias → image map
 *   3) optional DB URL (only if safe: no SVG, not a placeholder host)
 * Falls back to the global machine image if nothing matches.
 */
export function resolveMachineImage(input: {
  type?: string | null;
  name?: string | null;
  dbUrl?: string | null;
}): MachineImage {
  // 1) Try by type
  let hit = getMachineImage(input.type ?? "");

  // 2) Try by name if still the global fallback
  if (hit.src === imageContent.fallback.machine) {
    hit = getMachineImage(input.name ?? "");
  }

  // 3) Prefer DB URL if it's safe (remote SVGs/placeholder hosts are ignored)
  const url = (input.dbUrl ?? "").trim();
  if (url && isSafeRemoteImageUrl(url)) {
    return { src: url, alt: hit.alt }; // reuse alt (or set `Image of ...` at callsite)
  }

  // 4) Map/local image or fallback
  return hit;
}

/** Tiny guard against remote SVGs and known placeholder hosts (e.g., placehold.co). */
export function isSafeRemoteImageUrl(u: string): boolean {
  const url = u.toLowerCase();
  if (url.endsWith(".svg") || url.startsWith("data:image/svg")) return false;

  try {
    const host = new URL(u).hostname;
    // Block obvious placeholder domains; expand as needed
    if (/(^|\.)placehold\.co$/i.test(host)) return false;
  } catch {
    return false; // invalid URL
  }
  return true;
}
