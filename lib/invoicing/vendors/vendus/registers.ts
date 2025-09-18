import "server-only";
import { http } from "./core";
import type { DocType, VendusRegister, VendusRegisterDetail } from "./core";

/** Fetch the compact register list (v1.0). */
export async function getRegisterList(): Promise<VendusRegister[]> {
  return http<VendusRegister[]>("GET", "/v1.0/registers/");
}

/** Fetch a single register detail (v1.1). */
export async function getRegisterDetail(registerId: number): Promise<VendusRegisterDetail> {
  return http<VendusRegisterDetail>("GET", `/v1.1/registers/${registerId}/`);
}

/**
 * Resolve a usable register id.
 * - Prefers explicit env (done by caller before passing a preferred id).
 * - Otherwise: pick the first OPEN register for fiscal docs; otherwise the first available.
 */
export async function resolveRegisterIdFor(
  docType: DocType,
  preferredId?: number | null
): Promise<number> {
  if (preferredId && Number.isFinite(preferredId)) return preferredId;

  const list = await getRegisterList();

  // For FR/FT/NC (fiscal) prefer an OPEN register.
  const isFiscal = docType === "FR" || docType === "FT" || docType === "NC";
  if (isFiscal) {
    const open = list.find((r) => r.status === "open");
    if (open) return open.id;
  }

  // Fallback: any register we can see.
  if (list.length > 0) return list[0].id;

  throw new Error("No registers available in Vendus. Create one in backoffice.");
}

/**
 * Ensure a register can issue the requested doc type, with helpful errors.
 * Vendus only lets you “open” POS/normal registers. API-type cannot be opened in UI.
 * We therefore DO NOT require type==="api".
 * - FR/FT/NC require an OPEN session; PF can pass while CLOSED.
 */
export async function assertRegisterCanIssue(
  registerId: number,
  docType: DocType
): Promise<void> {
  const detail = await getRegisterDetail(registerId);

  // Inactive register
  if (detail.situation === "off") {
    throw new Error(
      `Vendus register ${registerId} is inactive. Activate it in backoffice (Registers → enable).`
    );
  }

  // Fiscal docs require an open session
  const isFiscal = docType === "FR" || docType === "FT" || docType === "NC";
  if (isFiscal && detail.status === "close") {
    throw new Error(
      `Vendus register ${registerId} is CLOSED. Open a POS session in backoffice before issuing ${docType}.`
    );
  }
}
