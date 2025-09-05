// Thin compatibility layer. Keep existing imports working while delegating
// to the new modular off-session implementation.

export { attemptOffSessionAuthorizationForBooking } from "./offsession/service";
export type { OffSessionAuthResult } from "./offsession/domain";
