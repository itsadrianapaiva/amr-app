import type { StaticImageData } from "next/image";
import { CANONICAL_IMAGE_KEYS } from "./config";

/** Machine image descriptor */
export interface MachineImage {
  src: StaticImageData | string;
  alt: string;
}

/* --------------------------------------------------------------------------
   Static imports for machine images
---------------------------------------------------------------------------*/

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

import mercedesTipper from "@/public/images/optimized/machines/mercedes-tipper.webp";
import tipperWithCrane from "@/public/images/optimized/machines/tipper-with-crane.webp";
import volvoDumpTruck from "@/public/images/optimized/machines/volvo-dump-truck.webp";

import rideBehindSkidSteerMini from "@/public/images/optimized/machines/ride-behind-skidsteer-mini.webp";
import microExcavator from "@/public/images/optimized/machines/micro-excavator.webp";
import miniDumper from "@/public/images/optimized/machines/mini-dumper.webp";
import concreteProjectionGun from "@/public/images/machines/concrete-projection-gun.webp";

/* Fallback image */
export const FALLBACK_MACHINE_IMAGE =
  "/images/machines/_fallback.jpg" as const;

/* --------------------------------------------------------------------------
   Machine images object
---------------------------------------------------------------------------*/

export const machineImages = {
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
} as Record<string, MachineImage>;

/* --------------------------------------------------------------------------
   Development-mode sync validation
---------------------------------------------------------------------------*/

if (process.env.NODE_ENV === "development") {
  const actualKeys = Object.keys(machineImages).sort();
  const configKeys = [...CANONICAL_IMAGE_KEYS].sort();
  const missing = configKeys.filter((k) => !actualKeys.includes(k));
  const extra = actualKeys.filter((k) => !configKeys.includes(k));

  if (missing.length || extra.length) {
    console.error("[lib/content/images/machines.ts] Sync error with config:");
    if (missing.length)
      console.error("  Missing in machineImages:", missing);
    if (extra.length)
      console.error("  Extra in machineImages:", extra);
  }
}
