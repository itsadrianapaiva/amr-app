"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { BookingFormValues } from "@/lib/validation/booking";
import { loadDraft, saveDraft, clearDraft } from "@/lib/client/draft";

/**
 * Versioned, minimal draft payload. Keep it tiny and stable for safe evolution.
 */
type DraftV1 = {
  v: 1;
  dateRange?: { from?: string | null; to?: string | null };
  name?: string;
  email?: string;
  phone?: string;
  customerNIF?: string;
  deliverySelected?: boolean;
  pickupSelected?: boolean;
  insuranceSelected?: boolean;
  operatorSelected?: boolean;
  siteAddress?: {
    line1?: string;
    postalCode?: string;
    city?: string;
    notes?: string;
  };
  billingIsBusiness?: boolean;
  billingCompanyName?: string;
  billingTaxId?: string;
  billingAddressLine1?: string;
  billingPostalCode?: string;
  billingCity?: string;
  billingCountry?: string;
};

function toISOorNull(d?: Date | null) {
  return d instanceof Date && !isNaN(d.valueOf()) ? d.toISOString() : null;
}
function reviveDate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.valueOf()) ? undefined : d;
}

function extract(values: BookingFormValues): DraftV1 {
  return {
    v: 1,
    dateRange: {
      from: toISOorNull(values.dateRange?.from ?? undefined),
      to: toISOorNull(values.dateRange?.to ?? undefined),
    },
    name: values.name,
    email: values.email,
    phone: values.phone,
    customerNIF: values.customerNIF ?? "",
    deliverySelected: !!values.deliverySelected,
    pickupSelected: !!values.pickupSelected,
    insuranceSelected: !!values.insuranceSelected,
    operatorSelected: !!values.operatorSelected,
    siteAddress: {
      line1: values.siteAddress?.line1 ?? "",
      postalCode: values.siteAddress?.postalCode ?? "",
      city: values.siteAddress?.city ?? "",
      notes: values.siteAddress?.notes ?? "",
    },
    billingIsBusiness: !!values.billingIsBusiness,
    billingCompanyName: values.billingCompanyName ?? "",
    billingTaxId: values.billingTaxId ?? "",
    billingAddressLine1: values.billingAddressLine1 ?? "",
    billingPostalCode: values.billingPostalCode ?? "",
    billingCity: values.billingCity ?? "",
    billingCountry: values.billingCountry ?? "",
  };
}

function merge(
  current: BookingFormValues,
  draft: DraftV1 | null
): BookingFormValues {
  if (!draft || draft.v !== 1) return current;
  return {
    ...current,
    dateRange: {
      from: reviveDate(draft.dateRange?.from ?? null),
      to: reviveDate(draft.dateRange?.to ?? null),
    },
    name: draft.name ?? current.name,
    email: draft.email ?? current.email,
    phone: draft.phone ?? current.phone,
    customerNIF: draft.customerNIF ?? current.customerNIF,
    deliverySelected:
      typeof draft.deliverySelected === "boolean"
        ? draft.deliverySelected
        : current.deliverySelected,
    pickupSelected:
      typeof draft.pickupSelected === "boolean"
        ? draft.pickupSelected
        : current.pickupSelected,
    insuranceSelected:
      typeof draft.insuranceSelected === "boolean"
        ? draft.insuranceSelected
        : current.insuranceSelected,
    operatorSelected:
      typeof draft.operatorSelected === "boolean"
        ? draft.operatorSelected
        : current.operatorSelected,
    siteAddress: {
      line1: draft.siteAddress?.line1 ?? current.siteAddress?.line1 ?? "",
      postalCode:
        draft.siteAddress?.postalCode ?? current.siteAddress?.postalCode ?? "",
      city: draft.siteAddress?.city ?? current.siteAddress?.city ?? "",
      notes: draft.siteAddress?.notes ?? current.siteAddress?.notes ?? "",
    },
    billingIsBusiness:
      typeof draft.billingIsBusiness === "boolean"
        ? draft.billingIsBusiness
        : current.billingIsBusiness,
    billingCompanyName:
      draft.billingCompanyName ?? current.billingCompanyName ?? "",
    billingTaxId: draft.billingTaxId ?? current.billingTaxId ?? "",
    billingAddressLine1:
      draft.billingAddressLine1 ?? current.billingAddressLine1 ?? "",
    billingPostalCode:
      draft.billingPostalCode ?? current.billingPostalCode ?? "",
    billingCity: draft.billingCity ?? current.billingCity ?? "",
    billingCountry: draft.billingCountry ?? current.billingCountry ?? "",
  };
}

/**
 * useBookingDraft
 * - Loads a stored draft once on mount and resets the form with merged values
 * - Persists changes with a light debounce (default 300ms)
 * - Exposes a clear() method to remove the draft (use on success page)
 */
export function useBookingDraft(opts: {
  form: UseFormReturn<BookingFormValues>;
  machineId: number | string;
  debounceMs?: number;
}) {
  const { form, machineId, debounceMs = 300 } = opts;
  const key = React.useMemo(() => `amr:draft:${machineId}`, [machineId]);

  // Load on mount
  React.useEffect(() => {
    const draft = loadDraft<DraftV1>(key);
    if (!draft) return;
    const merged = merge(form.getValues(), draft);
    form.reset(merged);
    void form.trigger(["dateRange", "siteAddress"]);
  }, [key]);

  // Save on change (debounced)
  const debounceRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const sub = form.watch((values) => {
      const payload = extract(values as BookingFormValues);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(
        () => saveDraft(key, payload),
        debounceMs
      );
    });
    return () => {
      sub.unsubscribe();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [form, key, debounceMs]);

  // Clearer for success page or explicit user action
  const clear = React.useCallback(() => clearDraft(key), [key]);

  return { clear, key };
}
