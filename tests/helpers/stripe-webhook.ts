import Stripe from "stripe";

/**
 * We only need the library to generate a valid "stripe-signature" header.
 * No Stripe API calls are made; the key value is irrelevant here.
 */
const stripe = new Stripe("sk_test_dummy");

/**
 * Picks the correct secret for the current environment.
 * - Local dev with `stripe listen`: set STRIPE_CLI_WEBHOOK_SECRET in .env.local
 * - Staging/prod/CI: set STRIPE_WEBHOOK_SECRET (Dashboard endpoint secret)
 */
function pickSecret(): string {
  const s =
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_CLI_WEBHOOK_SECRET ||
    "";
  if (!s) {
    throw new Error(
      "Missing STRIPE_WEBHOOK_SECRET (staging/prod/CI) or STRIPE_CLI_WEBHOOK_SECRET (local)."
    );
  }
  return s;
}

/**
 * Converts any payload into the exact JSON string Stripe signs.
 * Do not pretty-print; constructEvent expects the raw bytes.
 */
export function toRawJson(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

/**
 * Generates a valid "stripe-signature" header for the given payload using the
 * appropriate secret for this environment.
 */
export function signatureFor(payloadString: string): string {
  const secret = pickSecret();
  return stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret,
  });
}

/**
 * Convenience: build headers + raw body for a signed webhook POST.
 */
export function buildSignedRequest(payload: unknown) {
  const body = toRawJson(payload);
  const sig = signatureFor(body);
  return {
    body,
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig,
    },
  } as const;
}

/**
 * Optional: perform the POST with a provided fetch-like impl (e.g., global fetch
 * in Vitest or Playwright's request.fetch).
 */
export async function postSignedWebhook(
  url: string,
  payload: unknown,
  fetchImpl: (
    input: RequestInfo,
    init?: RequestInit
  ) => Promise<Response> = fetch
) {
  const { body, headers } = buildSignedRequest(payload);
  return fetchImpl(url, {
    method: "POST",
    headers,
    body,
  });
}
