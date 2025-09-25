/**
 * Stripe Audit Script
 * Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/ops/stripe-audit.mjs
 * Goal: Quick visibility into payouts readiness, support profile, and tax registrations.
 */

import Stripe from "stripe";

// 1) Guard: require a secret key in env
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY in env. Aborting.");
  process.exit(1);
}

// 2) Instantiate Stripe client
const stripe = new Stripe(key, {
  // Use your project default API version; leaving unset avoids conflicts
  // apiVersion: "2024-06-20",
});

// 3) Pretty helpers
const ok = (msg) => console.log(`✔ ${msg}`);
const warn = (msg) => console.warn(`! ${msg}`);
const info = (msg) => console.log(`• ${msg}`);

async function auditAccount() {
  // 4) Fetch the current account details
  const acct = await stripe.accounts.retrieve();

  info(`Account: ${acct.id}`);
  info(`Country: ${acct.country}`);
  info(`Charges enabled: ${acct.charges_enabled}`);
  info(`Payouts enabled: ${acct.payouts_enabled}`);
  info(`Details submitted: ${acct.details_submitted}`);

  if (acct.charges_enabled) ok("Charges are enabled");
  else warn("Charges are not enabled");

  if (acct.payouts_enabled) ok("Payouts are enabled");
  else warn("Payouts are not enabled");

  // 5) Business profile sanity
  const bp = acct.business_profile || {};
  if (bp.url) ok(`Public URL set: ${bp.url}`); else warn("Public URL missing");
  if (bp.support_email) ok(`Support email set: ${bp.support_email}`); else warn("Support email missing");
  if (bp.support_phone) ok(`Support phone set: ${bp.support_phone}`); else warn("Support phone missing");
  if (bp.support_address) {
    const a = bp.support_address;
    ok(`Support address: ${[a.line1, a.line2, a.postal_code, a.city, a.country].filter(Boolean).join(", ")}`);
  } else {
    warn("Support address missing");
  }

  // 6) Tax settings + PT registration check
  try {
    const taxSettings = await stripe.tax.settings.retrieve();
    const taxMode = taxSettings.active ? "active" : "inactive";
    info(`Stripe Tax is ${taxMode}`);

    if (!taxSettings.active) {
      warn("Stripe Tax inactive. PT VAT will not be calculated via Stripe Tax.");
    }

    const regs = await stripe.tax.registrations.list({ limit: 100 });
    const pt = regs.data.find(r => r.country === "PT");
    if (pt) {
      ok(`PT tax registration present. Status: ${pt.status || "unknown"}`);
      // Some accounts store VAT numbers through dashboard fields not directly exposed here.
      // This confirms the PT registration object exists and is active/pending.
    } else {
      warn("No PT tax registration found. Add PT registration with AMR NIF in Stripe Tax.");
    }
  } catch (e) {
    warn(`Stripe Tax API not accessible or not enabled: ${e.message}`);
  }

  // 7) Webhook endpoints overview (helps confirm correct env secrets and raw body parsing)
  try {
    const wh = await stripe.webhookEndpoints.list({ limit: 20 });
    if (wh.data.length) {
      ok(`Found ${wh.data.length} webhook endpoint(s).`);
      for (const w of wh.data) {
        info(`Webhook: ${w.url} [${w.status}] events=${w.enabled_events?.length || 0}`);
      }
    } else {
      warn("No webhook endpoints configured. Webhooks are required for post-payment flows.");
    }
  } catch (e) {
    warn(`Cannot list webhook endpoints: ${e.message}`);
  }

  // 8) Balance snapshot in test mode is useful before running payouts
  try {
    const bal = await stripe.balance.retrieve();
    info(`Balance available: ${JSON.stringify(bal.available)}`);
    info(`Balance pending:   ${JSON.stringify(bal.pending)}`);
  } catch (e) {
    // Standard accounts can retrieve balance with their key
    warn(`Cannot retrieve balance: ${e.message}`);
  }

  ok("Audit complete");
}

// 9) Run
auditAccount().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
