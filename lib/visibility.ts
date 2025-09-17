/**
 * Visibility helpers for internal or test-only machines.
 * Convention: names starting with "ZZZ " or containing "Do Not Rent" or "TEST".
 */

export const INTERNAL_NAME_PREFIX = "ZZZ ";

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/** Returns true when a machine name matches our internal/test convention. */
export function isInternalTestMachineName(name: unknown): boolean {
  if (!isNonEmptyString(name)) return false;
  const n = name.trim();
  if (n.startsWith(INTERNAL_NAME_PREFIX)) return true;
  if (/do not rent/i.test(n)) return true;
  if (/\btest\b/i.test(n)) return true;
  return false;
}

/** Catalog filter: remove internal/test machines from lists. */
export function hideInternalForCatalog<T extends { name?: string }>(
  rows: T[]
): T[] {
  return rows.filter((r) => !isInternalTestMachineName(r?.name));
}

/** Env toggles */
export const HIDE_INTERNAL_DETAIL =
  typeof process !== "undefined" && process.env.HIDE_INTERNAL_DETAIL === "1";

/** list hiding is OFF by default; enable with HIDE_INTERNAL_LIST=1 */
export const HIDE_INTERNAL_LIST =
  typeof process !== "undefined" && process.env.HIDE_INTERNAL_LIST === "1";

/** Use this in list loaders: only hide when the env flag is on. */
export function filterInternalIfEnabled<T extends { name?: string }>(
  rows: T[]
): T[] {
  return HIDE_INTERNAL_LIST ? hideInternalForCatalog(rows) : rows;
}

/** Detail use: true if this machine should be hidden on detail pages. */
export function shouldHideDetailByName(name: unknown): boolean {
  return HIDE_INTERNAL_DETAIL && isInternalTestMachineName(name);
}
