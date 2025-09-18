import "server-only";

/**
 * Thin delegator so existing imports keep working:
 *   import { vendusProvider } from "@/lib/invoicing/vendus"
 *
 * The real implementation now lives in:
 *   lib/invoicing/vendors/vendus/*
 * which is split into small, testable modules.
 */

export { vendusProvider } from "./vendors/vendus";
export { vendusProvider as default } from "./vendors/vendus";

// Optional: bubble up commonly-used helper types if callers need them later.
// Re-exporting only types does not bloat the runtime bundle.
export type {
  DocType,
  VendusRegister,
  VendusRegisterDetail,
  VendusDocResponse,
} from "./vendors/vendus/core";
