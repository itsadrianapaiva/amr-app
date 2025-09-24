import "server-only";

/**
 * Company Profile Facade
 * Prefers content from lib/content/contacts, falls back to env.
 * Keeps emails/invoices/legal in sync without touching existing sections.
 */

export type CompanyProfile = {
  name: string;            // COMPANY_NAME
  legalName: string;       // COMPANY_LEGAL_NAME
  nif: string;             // COMPANY_NIF (Portuguese NIF/NIPC)
  addressOneLine: string;  // COMPANY_LEGAL_ADDRESS or CONTACTS.location
  emailSupport?: string;   // SUPPORT_EMAIL or CONTACTS.support.email
  phone?: string;          // SUPPORT_PHONE or CONTACTS.support.whatsapp.display/e164
  website?: string;        // COMPANY_WEBSITE
  warehouseAddress?: string; // WAREHOUSE_ADDRESS
  warehouseHours?: string;   // WAREHOUSE_HOURS
};

const isProd = process.env.NODE_ENV === "production";

function readEnv(key: string, required = false): string | undefined {
  const v = process.env[key]?.trim();
  if (required && isProd && !v) throw new Error(`Missing required env: ${key}`);
  return v || undefined;
}

/** Best-effort mapper from lib/content/contacts (no hard dependency). */
async function loadFromContacts(): Promise<Partial<CompanyProfile> | null> {
  try {
    const mod = await import("@/lib/content/contacts");
    const c: any = (mod as any).CONTACTS;
    if (!c) return null;

    // Build a single-line address from ContactContent.location if present.
    const loc = c.location ?? {};
    const addrParts = [
      loc.addressLine1,
      loc.region,
      loc.postalCode,
      loc.city,
      loc.country,
    ].filter(Boolean);
    const addressOneLine = addrParts.join(", ").replace(/\s+/g, " ").trim();

    // Prefer human display number; fallback to E.164 if display missing.
    const wa = c.support?.whatsapp ?? {};
    const phone = c.support?.phone ?? wa.display ?? wa.e164;

    const mapped: Partial<CompanyProfile> = {
      emailSupport: c.support?.email,
      phone,
      addressOneLine: addressOneLine || undefined,
    };
    return mapped;
  } catch {
    return null;
  }
}

/** Public API: prefer content, fill gaps from env (strict in prod for core fields). */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const fromContacts = await loadFromContacts();

  const envName = readEnv("COMPANY_NAME", true) ?? "Algarve Machinery Rental";
  const envLegal = readEnv("COMPANY_LEGAL_NAME", true) ?? "Trevo Cativante Unip Lda";
  const envNif = readEnv("COMPANY_NIF", true) ?? "000000000";
  const envAddr = readEnv("COMPANY_LEGAL_ADDRESS", true) ?? "Address, 0000-000 City, Portugal";

  return {
    name: envName,
    legalName: envLegal,
    nif: envNif,
    addressOneLine: fromContacts?.addressOneLine ?? envAddr,
    emailSupport: fromContacts?.emailSupport ?? readEnv("SUPPORT_EMAIL"),
    phone: fromContacts?.phone ?? readEnv("SUPPORT_PHONE"),
    website: readEnv("COMPANY_WEBSITE"),
    warehouseAddress: readEnv("WAREHOUSE_ADDRESS"),
    warehouseHours: readEnv("WAREHOUSE_HOURS"),
  };
}

/** Utility: normalize any one-line address (defensive no-op). */
export function formatOneLineAddress(s: string): string {
  return (s || "").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}
