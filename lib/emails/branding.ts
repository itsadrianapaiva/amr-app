"use server";

import { getCompanyProfile } from "@/lib/company/profile";

/**
 * EmailBranding
 * Canonical, email-safe company fields for customer-facing templates.
 * We keep this minimal and stable so templates stay dumb.
 */
export type EmailBranding = {
  companyName: string;
  companyEmail: string; // reply-to / footer contact
  supportPhone: string; // human display, fallback to E.164 if needed
  companySite: string; // absolute URL
  warehouseAddress: string; // optional but helpful for logistics
  warehouseHours: string; // optional, human-readable
};

/**
 * getEmailBranding
 * Source of truth chain:
 *   - Legal/identity from env via profile facade
 *   - Support email/phone from CONTACTS (if present), else env fallbacks
 *   - Warehouse info from env
 *
 * Strict in production for required values; flexible in staging/dev.
 */
export async function getEmailBranding(): Promise<EmailBranding> {
  const profile = await getCompanyProfile();

  // Company name + site are required for emails.
  const companyName =
    profile.name || process.env.COMPANY_NAME || "Algarve Machinery Rental";

  const companySite =
    profile.website ||
    process.env.COMPANY_WEBSITE ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://amr-rentals.com";

  // Support email: prefer CONTACTS/support, then SUPPORT_EMAIL env,
  // then EMAIL_REPLY_TO, finally EMAIL_FROM as absolute fallback.
  const companyEmail =
    profile.emailSupport ||
    process.env.SUPPORT_EMAIL ||
    process.env.EMAIL_REPLY_TO ||
    process.env.EMAIL_FROM ||
    "support@amr-rentals.com";

  // Phone: prefer the human-friendly display from CONTACTS.whatsapp.display,
  // else SUPPORT_PHONE env, else E.164. Last resort: empty string.
  const supportPhone =
    profile.phone ||
    process.env.SUPPORT_PHONE ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    "";

  // Logistics (optional): shown in emails if available.
  const warehouseAddress =
    process.env.WAREHOUSE_ADDRESS ||
    "Barranco da Vaca, 8670-116, Aljezur, Portugal";

  const warehouseHours = process.env.WAREHOUSE_HOURS || "Mo–Fr 09:00–17:00";

  return {
    companyName,
    companyEmail,
    supportPhone,
    companySite,
    warehouseAddress,
    warehouseHours,
  };
}

/**
 * InternalBranding
 * Minimal fields for Ops/internal emails. Admin email must exist in prod.
 */
export type InternalBranding = {
  companyName: string;
  adminEmail: string;
};

export async function getInternalBranding(): Promise<InternalBranding> {
  const p = await getCompanyProfile();
  const isProd = process.env.NODE_ENV === "production";

  const companyName =
    p.name || process.env.COMPANY_NAME || "Algarve Machinery Rental";

  // Prefer explicit ADMIN_TO, then EMAIL_ADMIN_TO (both appear in your env),
  // fall back to SUPPORT_EMAIL so nothing breaks in staging/dev.
  const adminEmail =
    process.env.ADMIN_TO ||
    process.env.EMAIL_ADMIN_TO ||
    process.env.SUPPORT_EMAIL ||
    "support@amr-rentals.com";

  if (isProd && !adminEmail) {
    throw new Error(
      "Missing admin email (ADMIN_TO or EMAIL_ADMIN_TO) in production"
    );
  }

  return { companyName, adminEmail };
}
