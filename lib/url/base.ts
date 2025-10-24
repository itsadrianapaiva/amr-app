/**
 * Shared base URL resolver for building absolute URLs across the app.
 * Used in checkout, emails, webhooks, etc.
 */

/** Resolve the canonical base URL for building absolute https redirect URLs. */
export function resolveBaseUrl(): string {
  // Candidate order: explicit overrides first, then Netlify built-ins
  const candidates = [
    process.env.APP_URL?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.URL?.trim(), // Netlify published or branch URL
    process.env.DEPLOY_PRIME_URL?.trim(), // Netlify previews/branch deploys
  ].filter(Boolean) as string[];

  // Ignore accidental literal "$FOO" values (Netlify UI doesn't expand vars)
  const pick = candidates.find((v) => !v.startsWith("$")) ?? "";

  // In production, never fall back to localhost — fail fast and loudly
  if (!pick) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Base URL missing. Provide APP_URL (or rely on Netlify URL/DEPLOY_PRIME_URL)."
      );
    }
    return "http://localhost:3000";
  }

  // Validate and normalize
  let u: URL;
  try {
    u = new URL(pick);
  } catch {
    throw new Error(`APP_URL/URL value is not a valid absolute URL: "${pick}"`);
  }

  // Enforce https scheme in production (Stripe requires absolute https)
  if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
    throw new Error(
      `Base URL must be https in production; got "${u.protocol}".`
    );
  }

  const origin = u.origin;

  if (process.env.LOG_CHECKOUT_DEBUG === "1") {
    // Non-secret breadcrumb to verify which base won
    console.log("[url] base_url_resolved", { origin });
  }

  return origin;
}
