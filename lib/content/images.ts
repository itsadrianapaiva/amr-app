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

/* Re-export MachineImage from machines module */
export type { MachineImage } from "./images/machines";

/* --------------------------------------------------------------------------
   Static imports for Hero and Why sections
   NOTE: Machine imports moved to ./images/machines.ts
---------------------------------------------------------------------------*/

/* Hero */
import hero01 from "@/public/images/optimized/hero/hero.webp";
import hero02 from "@/public/images/optimized/hero/hero-02.webp";
import hero03 from "@/public/images/optimized/hero/hero-03.webp";

/* Why section */
import whyDefault from "@/public/images/misc/homepage-02.jpg";
import whyAlt from "@/public/images/misc/homepage.jpg";

/* --------------------------------------------------------------------------
   Import machine images from subfolder
---------------------------------------------------------------------------*/
import { machineImages, FALLBACK_MACHINE_IMAGE } from "./images/machines";

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

  // Machine images imported from ./images/machines.ts
  machines: machineImages,

  fallback: {
    machine: FALLBACK_MACHINE_IMAGE,
  },
} as const;

/* --------------------------------------------------------------------------
   Re-export helper functions for backward compatibility
---------------------------------------------------------------------------*/
export {
  getMachineImage,
  resolveMachineImage,
  isSafeRemoteImageUrl,
} from "./images/helpers";

/* Re-export config for backward compatibility (if needed) */
export { MACHINE_IMAGE_ALIASES, CANONICAL_IMAGE_KEYS } from "./images/config";
