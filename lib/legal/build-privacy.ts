import "server-only";
import { LEGAL_PRIVACY, type LegalDoc } from "@/lib/content/legal";
import { getCompanyProfile } from "@/lib/company/profile";

/**
 * getPrivacyDoc
 * Returns the LEGAL_PRIVACY doc with its "Data Controller" section
 * hydrated from current AMR company profile (env + contacts content).
 */
export async function getPrivacyDoc(): Promise<LegalDoc> {
  const base = LEGAL_PRIVACY;
  const p = await getCompanyProfile();

  // Assemble controller lines from live profile
  const controllerLines = [
    `Company: ${p.legalName}`,
    `Registered address: ${p.addressOneLine}`,
    p.warehouseAddress ? `Warehouse address: ${p.warehouseAddress}` : null,
    p.warehouseHours ? `Warehouse hours: ${p.warehouseHours}` : null,
    p.website ? `Website: ${p.website}` : null,
    p.emailSupport ? `Email: ${p.emailSupport}` : null,
  ].filter(Boolean) as string[];

  // Replace existing "controller" section or insert if missing
  const sections = base.sections.some((s) => s.id === "controller")
    ? base.sections.map((s) =>
        s.id === "controller" ? { ...s, body: controllerLines } : s
      )
    : [
        { id: "controller", title: "Data Controller", body: controllerLines },
        ...base.sections,
      ];

  // Preserve title, lastUpdated, links, etc.
  return { ...base, sections };
}
