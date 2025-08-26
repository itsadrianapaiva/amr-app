"use client";

/**
 * Minimal client-side draft helpers backed by sessionStorage.
 * - Safe in SSR: guards against window being undefined.
 * - JSON parse/stringify wrapped in try/catch to avoid throwing.
 */

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

function hasSession(): boolean {
  // Ensure we only touch storage on the client and when available.
  return typeof window !== "undefined" && !!window.sessionStorage;
}

/** Load a draft object by key; returns null when missing or on parse errors. */
export function loadDraft<T extends JSONValue>(key: string): T | null {
  if (!hasSession()) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or non-JSON payloads are ignored.
    return null;
  }
}

/** Save a draft object by key; no-ops on stringify or quota errors. */
export function saveDraft(key: string, data: JSONValue): void {
  if (!hasSession()) return;
  try {
    // Keep payload minimal; the caller chooses what to persist.
    const raw = JSON.stringify(data);
    window.sessionStorage.setItem(key, raw);
  } catch {
    // Swallow quota or circular-structure errors silently.
  }
}

/** Remove a draft by key; safe to call even if it does not exist. */
export function clearDraft(key: string): void {
  if (!hasSession()) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}
