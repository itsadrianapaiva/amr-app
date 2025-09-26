import "server-only";
import { RENTAL_CONDITIONS, type RentalConditionsDoc } from "@/lib/content/rental-conditions";
import { getCompanyProfile } from "@/lib/company/profile";

/**
 * getGeneralConditionsDoc
 * Hydrates the "Contacts" appendix with live AMR profile (env + contacts content).
 * If a section with id "contacts" exists, replace its body; otherwise append it.
 */
export async function getGeneralConditionsDoc(): Promise<RentalConditionsDoc> {
  const base = RENTAL_CONDITIONS;
  const p = await getCompanyProfile();

  const contactsBody = [
    `Company: ${p.legalName}`,
    `Registered address: ${p.addressOneLine}`,
    p.warehouseAddress ? `Warehouse: ${p.warehouseAddress}` : null,
    p.warehouseHours ? `Warehouse hours: ${p.warehouseHours}` : null,
    p.emailSupport ? `Email: ${p.emailSupport}` : null,
    p.website ? `Website: ${p.website}` : null,
  ].filter(Boolean) as string[];

  const contactsSection = {
    id: "contacts",
    title: "Contacts",
    body: contactsBody,
  };

  const hasContacts = base.sections.some((s) => s.id === "contacts");
  const sections = hasContacts
    ? base.sections.map((s) => (s.id === "contacts" ? contactsSection : s))
    : [...base.sections, contactsSection];

  // Preserve title/intro/links/lastUpdated to keep the doc shape stable
  return { ...base, sections };
}
