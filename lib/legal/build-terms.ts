import "server-only";
import { LEGAL_TERMS, type LegalDoc } from "@/lib/content/legal";
import { getCompanyProfile } from "@/lib/company/profile";

/**
 * getTermsDoc
 * Returns the LEGAL_TERMS doc with a "Company Information" section
 * hydrated from current AMR company profile (env + contacts content).
 *
 * If a section with id "company" already exists, we replace its body.
 * Otherwise, we append a new section at the end to avoid breaking anchors.
 */
export async function getTermsDoc(): Promise<LegalDoc> {
  const base = LEGAL_TERMS;
  const p = await getCompanyProfile();

  const lines = [
    `Legal name: ${p.legalName}`,
    `NIF (VAT/NIPC): ${p.nif}`,
    `Registered address: ${p.addressOneLine}`,
    p.website ? `Website: ${p.website}` : null,
    p.emailSupport ? `Email: ${p.emailSupport}` : null,
    p.warehouseAddress ? `Warehouse: ${p.warehouseAddress}` : null,
    p.warehouseHours ? `Warehouse hours: ${p.warehouseHours}` : null,
  ].filter(Boolean) as string[];

  const companySection = { id: "company", title: "Company Information", body: lines };

  const hasCompany = base.sections.some((s) => s.id === "company");
  const sections = hasCompany
    ? base.sections.map((s) => (s.id === "company" ? companySection : s))
    : [...base.sections, companySection];

  return { ...base, sections };
}
