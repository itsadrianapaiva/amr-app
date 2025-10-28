export const INSURANCE_CHARGE = 50;
export const OPERATOR_CHARGE = 350;
//in euros. formatCurrency and moneyDisplay in lib/utils.ts help with display

/* Promo Modal Configuration */
/** Enable/disable first-rental promo modal on homepage */
export const PROMO_MODAL_ENABLED =
  process.env.NEXT_PUBLIC_PROMO_MODAL_ENABLED === "1";

/** Days to suppress modal after user dismisses it */
export const PROMO_MODAL_SUPPRESS_DAYS = parseInt(
  process.env.NEXT_PUBLIC_PROMO_MODAL_SUPPRESS_DAYS || "7",
  10
);

/** Google Reviews URL for secondary CTA */
export const PROMO_GOOGLE_URL =
  process.env.NEXT_PUBLIC_PROMO_GOOGLE_URL ||
  "https://g.page/r/CafsXz-d4JtYEAE";