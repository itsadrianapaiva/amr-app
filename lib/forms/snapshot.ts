"use client";

/**
 * Generic snapshot helper: read a list of form field names as strings.
 * Returns a plain Record<string,string> safe for JSON.
 */
export function snapshotFormFields(
  form: HTMLFormElement,
  keys: readonly string[]
): Record<string, string> {
  const fd = new FormData(form);
  const out: Record<string, string> = {};
  for (const k of keys) {
    out[k] = String(fd.get(k) ?? "");
  }
  return out;
}

/** Keys used by the /ops booking form. */
export const OPS_SNAPSHOT_KEYS = [
  "machineId",
  "startYmd",
  "endYmd",
  "managerName",
  "customerName",
  "siteAddressLine1",
  "siteAddressCity",
  "siteAddressNotes",
] as const;

/** Convenience wrapper: build the exact payload shape we need in /ops. */
export function snapshotOpsForm(form: HTMLFormElement): Record<string, string> {
  return snapshotFormFields(form, OPS_SNAPSHOT_KEYS);
}
