import type { StaticImageData } from "next/image";

/** Accept either a static import or a public/remote path string. */
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

/* --------------------------------------------------------------------------
   Static imports (unlock intrinsic sizes + blurDataURL for placeholders)
   NOTE: Paths are under /public; Next supports importing from there.
---------------------------------------------------------------------------*/

/* Hero */
import hero01 from "@/public/images/optimized/hero/hero.webp";
import hero02 from "@/public/images/optimized/hero/hero-02.webp";
import hero03 from "@/public/images/optimized/hero/hero-03.webp";

/* Why section */
import whyDefault from "@/public/images/misc/homepage-02.jpg";
import whyAlt from "@/public/images/misc/homepage.jpg";

/* Machines */
import miniExcavator from "@/public/images/machines/mini-excavator.jpg"; // No optimized WebP variant yet
import mediumExcavator from "@/public/images/optimized/machines/medium-excavator.webp";
import largeExcavator from "@/public/images/machines/large-excavator.jpg"; // No optimized WebP variant yet

import skidTracks from "@/public/images/machines/skid-steer-loader-tracks.jpg"; // No optimized WebP variant yet
import skidTracksLg from "@/public/images/optimized/machines/lg-skid-steer-loader-tracks-02.webp";
import skidWheels from "@/public/images/machines/wheel-skid-steer-loader-02.webp";

import telehandler from "@/public/images/optimized/machines/telehandler.webp";
import compactor from "@/public/images/optimized/machines/compactor.webp";
import cementMixer from "@/public/images/optimized/machines/cement-mixer.webp";
import powerWasher from "@/public/images/optimized/machines/power-washer.webp";
import holeBoringMachine from "@/public/images/optimized/machines/hole-boring-machine.webp";

// Trucks and haulers
import mercedesTipper from "@/public/images/optimized/machines/mercedes-tipper.webp";
import tipperWithCrane from "@/public/images/optimized/machines/tipper-with-crane.webp";
import volvoDumpTruck from "@/public/images/optimized/machines/volvo-dump-truck.webp";

/* Fallback (can remain a string path) */
const FALLBACK_MACHINE_IMAGE = "/images/machines/_fallback.jpg" as const;

/* CSV "Type"/Name slugs -> canonical machine-image keys */
const MACHINE_IMAGE_ALIASES: Record<string, string> = {
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
  "hole-boring-machine": "hole-boring-machine",

  // trucks & haulers – map CSV slugs to your canonical keys
  "3500-tipper-truck-with-driver": "mercedes-tipper",
  "3500-tipper-with-crane-and-driver": "tipper-with-crane",
  "16m3-truck-with-driver": "volvo-dump-truck",
};

/**
 * Centralized image content used across Hero, Why section, catalog cards,
 * and machine detail pages.
 */
export const imageContent = {
  /** Hero variants */
  hero: {
    // Keep string alt + static src (StaticImageData)
    variants: {
      default: {
        src: hero01,
        alt: "Tracked excavator working at sunrise",
        focal: "center",
      } as HeroImage,
      alt1: {
        src: hero02,
        alt: "Excavator silhouetted against the evening sky",
        focal: "center",
      } as HeroImage,
      alt2: {
        src: hero03,
        alt: "Heavy machinery at a coastal job site",
        focal: "center",
      } as HeroImage,
    },
  },

  /** Why section image variants */
  why: {
    default: {
      src: whyDefault,
      alt: "Construction machinery operating on a sunny job site",
    } as WhyImage,
    alt: {
      src: whyAlt,
      alt: "Excavator and crew preparing a building site",
    } as WhyImage,
  } as Record<"default" | "alt", WhyImage>,

  /** Machine images keyed by canonical machine slug */
  machines: {
    // Excavators
    "mini-excavator": {
      src: miniExcavator,
      alt: "Mini excavator at a residential job site",
    },
    "medium-excavator": {
      src: mediumExcavator,
      alt: "Medium excavator working on a construction site",
    },
    "large-excavator": {
      src: largeExcavator,
      alt: "Large excavator moving earth at a work site",
    },

    // Skid steers (tracks and wheels)
    "skid-steer-loader-tracks": {
      src: skidTracks,
      alt: "Compact track loader (skid steer with rubber tracks)",
    },
    "lg-skid-steer-loader-tracks": {
      src: skidTracksLg,
      alt: "Large compact track loader with rubber tracks",
    },
    "wheel-skid-steer-loader": {
      src: skidWheels,
      alt: "Wheeled skid steer loader on site",
    },

    // Lifting
    telehandler: {
      src: telehandler,
      alt: "Telescopic handler lifting materials",
    },

    // Compaction
    compactor: {
      src: compactor,
      alt: "Plate compactor for soil and base preparation",
    },

    // Concrete
    "cement-mixer": {
      src: cementMixer,
      alt: "Portable concrete mixer with drum",
    },

    // Cleaning
    "power-washer": {
      src: powerWasher,
      alt: "High-pressure power washer in outdoor use",
    },

    // Earth auger / hole boring
    "hole-boring-machine": {
      src: holeBoringMachine,
      alt: "Petrol hole boring machine with auger attachment",
    },

    // Trucks and haulers
    "mercedes-tipper": {
      src: mercedesTipper,
      alt: "Mercedes tipper with crane",
    },
    "tipper-with-crane": {
      src: tipperWithCrane,
      alt: "Tipper with crane on a construction site",
    },
    "volvo-dump-truck": {
      src: volvoDumpTruck,
      alt: "Volvo dump truck with crane",
    },
  } as Record<string, MachineImage>,

  /** Expose fallback for diagnostics if needed. */
  fallback: {
    machine: FALLBACK_MACHINE_IMAGE,
  },
} as const;

/* ----------------------------- helpers ---------------------------------- */

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
  } satisfies MachineImage;
}

/**
 * Decide the best image for a machine by trying:
 *   1) type -> alias -> image map
 *   2) name -> alias -> image map
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
    return { src: url, alt: hit.alt }; // reuse alt (or set "Image of ..." at callsite)
  }

  // 4) Map/local image or fallback
  return hit;
}

/** Tiny guard against remote SVGs and known placeholder hosts (for example, placehold.co). */
export function isSafeRemoteImageUrl(u: string): boolean {
  const url = u.toLowerCase();
  if (url.endsWith(".svg") || url.startsWith("data:image/svg")) return false;

  try {
    const host = new URL(u).hostname;
    if (/(^|\.)placehold\.co$/i.test(host)) return false;
  } catch {
    return false; // invalid URL
  }
  return true;
}
