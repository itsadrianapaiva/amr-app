import { MACHINE_IMAGE_ALIASES } from "./config";
import {
  machineImages,
  FALLBACK_MACHINE_IMAGE,
  type MachineImage,
} from "./machines";

/**
 * Helper functions for machine image resolution
 */

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
  const normalized = toSlugLike(slugOrType);
  const canonical = MACHINE_IMAGE_ALIASES[normalized] ?? normalized;

  const tries = [canonical, ...candidateKeys(slugOrType)];
  for (const key of tries) {
    const hit = machineImages[key];
    if (hit) return hit;
  }

  return {
    src: FALLBACK_MACHINE_IMAGE,
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
        src: FALLBACK_MACHINE_IMAGE,
        alt: "Construction machinery on site",
      };

  if (
    process.env.NODE_ENV === "development" &&
    normalizedCode &&
    hit.src === FALLBACK_MACHINE_IMAGE
  ) {
    console.warn(
      `[resolveMachineImage] Code "${rawCode}" (normalized: "${normalizedCode}") exists but no image match found. Falling back to type/name.`
    );
  }

  if (hit.src === FALLBACK_MACHINE_IMAGE) {
    hit = getMachineImage(input.type ?? "");
  }

  if (hit.src === FALLBACK_MACHINE_IMAGE) {
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
