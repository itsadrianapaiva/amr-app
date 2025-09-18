/**
 * Silences noisy geocoder logs during unit tests, without hiding real failures.
 * Behavior:
 * - If LOG_LEVEL=debug → pass through all logs (developer wants noise).
 * - Otherwise → filter console.error/console.warn lines that start with "[geo]".
 *
 * This file is safe: it only wraps console methods; it does not touch app code.
 */

const DEBUG = process.env.LOG_LEVEL === "debug";

// Keep originals so we can delegate for non-geo messages.
const origError = console.error;
const origWarn = console.warn;

/**
 * shouldFilter
 * Returns true if a message should be suppressed. We only filter messages that:
 * - are strings
 * - start with "[geo]" (our geofence/geocoder tag)
 */
function shouldFilter(args: unknown[]) {
  if (DEBUG) return false; // developer explicitly asked for noise
  if (!args.length) return false;
  const [first] = args;
  return typeof first === "string" && first.startsWith("[geo]");
}

// Wrap console.error
console.error = (...args: unknown[]) => {
  if (shouldFilter(args)) return;      // swallow geo error noise in tests
  origError(...args);                  // forward everything else
};

// Wrap console.warn
console.warn = (...args: unknown[]) => {
  if (shouldFilter(args)) return;      // swallow geo warn noise in tests
  origWarn(...args);                   // forward everything else
};
