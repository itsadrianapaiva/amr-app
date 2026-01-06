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
import miniExcavator from "@/public/images/machines/mini-excavator.jpg";
import mediumExcavator from "@/public/images/optimized/machines/medium-excavator.webp";
import largeExcavator from "@/public/images/machines/large-excavator.jpg";

import skidTracks from "@/public/images/machines/skid-steer-loader-tracks.jpg";
import skidTracksLg from "@/public/images/optimized/machines/lg-skid-steer-loader-tracks-02.webp";
import skidWheels from "@/public/images/machines/wheel-skid-steer-loader-02.webp";

import telehandler from "@/public/images/optimized/machines/telehandler.webp";
import compactor from "@/public/images/optimized/machines/compactor.webp";
import cementMixer from "@/public/images/optimized/machines/cement-mixer.webp";
import powerWasher from "@/public/images/optimized/machines/power-washer.webp";
import holeBoringMachine from "@/public/images/optimized/machines/hole-boring-machine.webp";

/* Trucks and haulers */
import mercedesTipper from "@/public/images/optimized/machines/mercedes-tipper.webp";
import tipperWithCrane from "@/public/images/optimized/machines/tipper-with-crane.webp";
import volvoDumpTruck from "@/public/images/optimized/machines/volvo-dump-truck.webp";

/* Mini / micro machines */
import rideBehindSkidSteerMini from "@/public/images/optimized/machines/ride-behind-skidsteer-mini.webp";
import microExcavator from "@/public/images/optimized/machines/micro-excavator.webp";
import miniDumper from "@/public/images/optimized/machines/mini-dumper.webp";
import concreteProjectionGun from "@/public/images/machines/concrete-projection-gun.webp";

/* Fallback (can remain a string path) */
const FALLBACK_MACHINE_IMAGE = "/images/machines/_fallback.jpg" as const;

/* CSV "Code"/Type/Name slugs -> canonical machine-image keys */
const MACHINE_IMAGE_ALIASES: Record<string, string> = {
  // skid steers
  "mini-bobcat-wheel": "wheel-skid-steer-loader",
  "mini-skid-steer-w-wheels": "wheel-skid-steer-loader",

  "bobcat-t450-track": "skid-steer-loader-tracks",
  "medium-bobcat-skid-steer-w-tracks": "skid-steer-loader-tracks",

  "bobcat-t190-track": "lg-skid-steer-loader-tracks",
  "larger-bobcat-skid-steer-w-tracks": "lg-skid-steer-loader-tracks",

  // excavators
  "mini-excavator-jcb": "mini-excavator",
  "bobcat-e80-excavator": "medium-excavator",
  "jcb-85z1-excavator": "large-excavator",

  // lifting
  "bobcat-tl619-telehandler": "telehandler",

  // light machinery
  "crommelins-compactor": "compactor",
  "concrete-mixer-200l": "cement-mixer",
  "vevor-post-hole-digger": "hole-boring-machine",
  "hyundai-petrol-powerwasher": "power-washer",

  // trucks
  "mercedes-tipper-3500": "mercedes-tipper",
  "isuzu-tipper-crane": "tipper-with-crane",
  "volvo-16m3-truck": "volvo-dump-truck",

  // NEW machines (codes)
  "ride-behind-skid-steer": "ride-behind-skidsteer-mini",
  "micro-excavator": "micro-excavator",
  "mini-dumper-loading-bucket": "mini-dumper",
  "concrete-projection-gun": "concrete-projection-gun",

  // legacy name-based aliases
  "3500-tipper-truck-with-driver": "mercedes-tipper",
  "3500-tipper-with-crane-and-driver": "tipper-with-crane",
  "16m3-truck-with-driver": "volvo-dump-truck",
};

/**
 * Centralized image content used across Hero, Why section, catalog cards,
 * and machine detail pages.
 */
export const imageContent = {
  hero: {
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

  why: {
    default: {
      src: whyDefault,
      alt: "Construction machinery operating on a sunny job site",
    } as WhyImage,
    alt: {
      src: whyAlt,
      alt: "Excavator and crew preparing a building site",
    } as WhyImage,
  },

  machines: {
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

    "skid-steer-loader-tracks": {
      src: skidTracks,
      alt: "Compact track loader with rubber tracks",
    },
    "lg-skid-steer-loader-tracks": {
      src: skidTracksLg,
      alt: "Large compact track loader with rubber tracks",
    },
    "wheel-skid-steer-loader": {
      src: skidWheels,
      alt: "Wheeled skid steer loader on site",
    },

    telehandler: {
      src: telehandler,
      alt: "Telescopic handler lifting materials",
    },

    compactor: {
      src: compactor,
      alt: "Plate compactor for soil and base preparation",
    },

    "cement-mixer": {
      src: cementMixer,
      alt: "Portable concrete mixer with drum",
    },

    "power-washer": {
      src: powerWasher,
      alt: "High-pressure power washer in outdoor use",
    },

    "hole-boring-machine": {
      src: holeBoringMachine,
      alt: "Petrol hole boring machine with auger attachment",
    },

    "mercedes-tipper": {
      src: mercedesTipper,
      alt: "Mercedes 3.5t tipper truck",
    },
    "tipper-with-crane": {
      src: tipperWithCrane,
      alt: "Tipper truck with crane",
    },
    "volvo-dump-truck": {
      src: volvoDumpTruck,
      alt: "Volvo 16m3 dump truck",
    },

    // NEW machines
    "ride-behind-skidsteer-mini": {
      src: rideBehindSkidSteerMini,
      alt: "Ride-behind skid steer mini loader",
    },
    "micro-excavator": {
      src: microExcavator,
      alt: "Micro excavator for tight access work",
    },
    "mini-dumper": {
      src: miniDumper,
      alt: "Mini dumper with loading bucket",
    },
    "concrete-projection-gun": {
      src: concreteProjectionGun,
      alt: "Concrete projection gun for shotcrete application",
    },
  } as Record<string, MachineImage>,

  fallback: {
    machine: FALLBACK_MACHINE_IMAGE,
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Helpers */
/* -------------------------------------------------------------------------- */

function toSlugLike(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

export function getMachineImage(slugOrType: string): MachineImage {
  const map = imageContent.machines;
  const normalized = toSlugLike(slugOrType);
  const canonical = MACHINE_IMAGE_ALIASES[normalized] ?? normalized;

  const tries = [canonical, ...candidateKeys(slugOrType)];
  for (const key of tries) {
    const hit = map[key];
    if (hit) return hit;
  }

  return {
    src: imageContent.fallback.machine,
    alt: "Construction machinery on site",
  };
}

export function resolveMachineImage(input: {
  code?: string | null;
  type?: string | null;
  name?: string | null;
  dbUrl?: string | null;
}): MachineImage {
  const rawCode = (input.code ?? "").trim();
  const normalizedCode = rawCode ? toSlugLike(rawCode) : "";

  let hit = normalizedCode
    ? getMachineImage(normalizedCode)
    : {
        src: imageContent.fallback.machine,
        alt: "Construction machinery on site",
      };

  if (
    process.env.NODE_ENV === "development" &&
    normalizedCode &&
    hit.src === imageContent.fallback.machine
  ) {
    console.warn(
      `[resolveMachineImage] Code "${rawCode}" (normalized: "${normalizedCode}") exists but no image match found. Falling back to type/name.`
    );
  }

  if (hit.src === imageContent.fallback.machine) {
    hit = getMachineImage(input.type ?? "");
  }

  if (hit.src === imageContent.fallback.machine) {
    hit = getMachineImage(input.name ?? "");
  }

  const url = (input.dbUrl ?? "").trim();
  if (url && isSafeRemoteImageUrl(url)) {
    return { src: url, alt: hit.alt };
  }

  return hit;
}

export function isSafeRemoteImageUrl(u: string): boolean {
  const url = u.toLowerCase();
  if (url.endsWith(".svg") || url.startsWith("data:image/svg")) return false;

  try {
    const host = new URL(u).hostname;
    if (/(^|\.)placehold\.co$/i.test(host)) return false;
  } catch {
    return false;
  }
  return true;
}
