/**
 * Test Payment → Balance Snapshot → Conditional Test Payout
 * Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/ops/stripe-test-payout.mjs
 *
 * Notes:
 * - Runs ONLY with a test key. Aborts on live keys.
 * - Confirms a PaymentIntent using a test PM (pm_card_visa).
 * - Logs balance pending/available.
 * - If available >= €1.00, attempts a €1.00 payout (test-mode).
 */

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY in env.");
  process.exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.error("Refusing to run with a live key. Use a test key (sk_test_...).");
  process.exit(1);
}

const stripe = new Stripe(key);

const ok = (msg) => console.log(`✔ ${msg}`);
const warn = (msg) => console.warn(`! ${msg}`);
const info = (msg) => console.log(`• ${msg}`);

async function createTestPayment() {
  // Create & confirm a €12.34 PaymentIntent in EUR
  const pi = await stripe.paymentIntents.create({
    amount: 1234,
    currency: "eur",
    confirmation_method: "automatic",
    confirm: true,
    payment_method: "pm_card_visa", // Stripe test PM
    description: "AMR test payment for payout dry-run",
    metadata: { context: "ops:payout-dry-run" },
  });
  return pi;
}

function sumBalance(balances) {
  // Sum across currencies; this script assumes a single currency (EUR) in test
  return balances.reduce((acc, b) => acc + (b.amount || 0), 0);
}

async function main() {
  info("Creating a test card payment (EUR 12.34)...");
  const pi = await createTestPayment();
  ok(`PaymentIntent ${pi.id} status=${pi.status}`);

  if (pi.status !== "succeeded") {
    warn("Payment is not succeeded; payout will be skipped.");
  }

  info("Retrieving balance snapshot...");
  const balance = await stripe.balance.retrieve();
  const available = sumBalance(balance.available || []);
  const pending = sumBalance(balance.pending || []);
  info(`Balance available (all currencies, minor units): ${available}`);
  info(`Balance pending   (all currencies, minor units): ${pending}`);

  // Attempt a tiny payout if at least €1.00 is available
  const oneEuro = 100;
  if (available >= oneEuro) {
    info("Attempting €1.00 test payout...");
    const payout = await stripe.payouts.create({
      amount: oneEuro,
      currency: "eur",
      // Instant payouts are not available in test; use standard
      method: "standard",
      metadata: { context: "ops:payout-dry-run" },
    });
    ok(`Created payout ${payout.id} status=${payout.status}`);
    info("Retrieve updated balance...");
    const balanceAfter = await stripe.balance.retrieve();
    info(`Available after payout: ${sumBalance(balanceAfter.available || [])}`);
    info(`Pending after payout:   ${sumBalance(balanceAfter.pending || [])}`);
  } else {
    warn("Insufficient available balance for a test payout; this is normal right after charge.");
    info("Payouts require *available* funds (not just pending). Try again later or with a larger prior balance.");
  }

  ok("Dry-run complete.");
}

main().catch((e) => {
  console.error("Dry-run failed:", e && e.message ? e.message : e);
  process.exit(1);
});
