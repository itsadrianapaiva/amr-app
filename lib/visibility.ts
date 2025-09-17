/**
 * Visibility helpers for internal/test-only machines.
 * Convention: names starting with "ZZZ " or containing "Do Not Rent"/"TEST"
 * are considered internal and should be hidden from public listings.
 * HIDE_INTERNAL_DETAIL reads an env flag. Set HIDE_INTERNAL_DETAIL=1 on Netlify to also block direct links.
 */

export const INTERNAL_NAME_PREFIX = "ZZZ ";

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/** True if a machine name follows our internal/test convention. */
export function isInternalTestMachineName(name: unknown): boolean {
  if (!isNonEmptyString(name)) return false;
  const n = name.trim();
  if (n.startsWith(INTERNAL_NAME_PREFIX)) return true;
  if (/do not rent/i.test(n)) return true;
  if (/\btest\b/i.test(n)) return true;
  return false;
}

/**
 * Filter for catalog pages: remove internal/test machines from lists.
 * Keeps the remaining array stable (no mutation).
 */
export function hideInternalForCatalog<T extends { name?: string }>(
  rows: T[]
): T[] {
  return rows.filter((r) => !isInternalTestMachineName(r?.name));
}

/**
 * Env-driven toggle to also hide *detail* pages in production.
 * Set HIDE_INTERNAL_DETAIL=1 to 404 internal machines by name.
 */
export const HIDE_INTERNAL_DETAIL =
  typeof process !== "undefined" && process.env.HIDE_INTERNAL_DETAIL === "1";

/** True if detail page should be hidden (when toggle is on). */
export function shouldHideDetailByName(name: unknown): boolean {
  return HIDE_INTERNAL_DETAIL && isInternalTestMachineName(name);
}
