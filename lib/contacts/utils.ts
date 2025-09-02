import type { WhatsAppConfig, LocationConfig } from "@/lib/content/contacts";

/** Build a WhatsApp deeplink for a given config. */
export function buildWhatsAppHref(wa: WhatsAppConfig): string {
  const digits = wa.e164.replace(/\D/g, "");
  const base = `https://wa.me/${digits}/`;
  if (wa.messageTemplate && wa.messageTemplate.trim().length > 0) {
    return `${base}?text=${encodeURIComponent(wa.messageTemplate)}`;
  }
  return base;
}

/** Returns a single-line formatted address. */
export function formatAddress(loc: LocationConfig): string {
  const parts = [
    loc.addressLine1,
    loc.postalCode,
    loc.city,
    loc.region,
    loc.country,
  ].filter(Boolean);
  return parts.join(", ");
}

/** Returns a usable Google Maps link for the location. */
export function getMapsLink(loc: LocationConfig): string | null {
  if (loc.mapsUrl && loc.mapsUrl.trim().length > 0) return loc.mapsUrl;
  const q = encodeURIComponent(formatAddress(loc));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export type ContactFormPayload = {
  name: string;
  email: string;
  message: string;
};

/** Extract and trim a payload out of a FormData instance. */
export function toFormPayload(fd: FormData): ContactFormPayload {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  return { name: get("name"), email: get("email"), message: get("message") };
}

/** Minimal email check (RFC-lite). Intentionally simple for UX. */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Validate payload; returns an array of human-friendly error strings. */
export function validateContactPayload(p: ContactFormPayload): string[] {
  const errors: string[] = [];
  if (!p.name) errors.push("Name is required.");
  if (!p.email) errors.push("Email is required.");
  else if (!isPlausibleEmail(p.email)) errors.push("Email looks invalid.");
  if (!p.message) errors.push("Message is required.");
  return errors;
}
