/**
 * Machine image configuration
 *
 * Pure data exports for machine image resolution. This file contains no
 * static imports or runtime dependencies, making it safe to import in
 * Node.js scripts (e.g., validation scripts).
 *
 * Source of truth for CSV code → canonical image key mappings.
 */

/* CSV "Code"/Type/Name slugs → canonical machine-image keys */
export const MACHINE_IMAGE_ALIASES: Record<string, string> = {
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

/** All canonical machine image keys */
export const CANONICAL_IMAGE_KEYS = [
  "mini-excavator",
  "medium-excavator",
  "large-excavator",
  "skid-steer-loader-tracks",
  "lg-skid-steer-loader-tracks",
  "wheel-skid-steer-loader",
  "telehandler",
  "compactor",
  "cement-mixer",
  "power-washer",
  "hole-boring-machine",
  "mercedes-tipper",
  "tipper-with-crane",
  "volvo-dump-truck",
  // NEW machines
  "ride-behind-skidsteer-mini",
  "micro-excavator",
  "mini-dumper",
  "concrete-projection-gun",
];
