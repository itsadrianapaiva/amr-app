// components/ops/ops-create-booking-form.tsx
"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import type { ManagerBookingActionResult } from "@/app/ops/actions";

// Keep the prop surface small and explicit.
type MachineOption = { id: number; name: string };

type OpsCreateBookingFormProps = {
  machines: MachineOption[];
  // Server-computed Lisbon "today" in YYYY-MM-DD for <input type="date" min="...">
  minYmd: string;
  // Pass the Server Action directly; it returns our discriminated union.
  serverAction: (
    input: Record<string, any>
  ) => Promise<ManagerBookingActionResult>;
};

export default function OpsCreateBookingForm({
  machines,
  minYmd,
  serverAction,
}: OpsCreateBookingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ManagerBookingActionResult | null>(null);

  // Helper to read the first error for a field key.
  const firstError = (key: string) =>
    result && !result.ok && result.fieldErrors && result.fieldErrors[key]?.[0];

  // Submit handler: serialize fields → call server action → render union result.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()); // plain object, all strings
    setResult(null);

    startTransition(async () => {
      const r = await serverAction(payload);
      setResult(r);
    });
  }

  // Tiny success banner
  const success = result && result.ok;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Non-field formError banner */}
      {!success && result && !result.ok && result.formError ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {result.formError}
        </div>
      ) : null}

      {/* Success banner */}
      {success ? (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          Booking created successfully. ID: <strong>{result.bookingId}</strong>
          {result.calendar?.eventId ? (
            <>
              {" "}
              • Calendar event: <code>{result.calendar.eventId}</code>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Machine */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">Machine</label>
        <select
          name="machineId"
          className="w-full rounded-md border p-2 text-sm"
          defaultValue={machines[0]?.id ?? ""}
        >
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {firstError("machineId") ? (
          <p className="text-xs text-red-600">{firstError("machineId")}</p>
        ) : null}
      </div>

      {/* Dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium">Start date</label>
          <input
            type="date"
            name="startDate"
            min={minYmd}
            className="w-full rounded-md border p-2 text-sm"
            required
          />
          {firstError("startDate") ? (
            <p className="text-xs text-red-600">{firstError("startDate")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">End date</label>
          <input
            type="date"
            name="endDate"
            min={minYmd}
            className="w-full rounded-md border p-2 text-sm"
            required
          />
          {firstError("endDate") ? (
            <p className="text-xs text-red-600">{firstError("endDate")}</p>
          ) : null}
        </div>
      </div>

      {/* Manager  */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">Manager name</label>
        <input
          name="managerName"
          className="w-full rounded-md border p-2 text-sm"
          required
        />
        {firstError("managerName") ? (
          <p className="text-xs text-red-600">{firstError("managerName")}</p>
        ) : null}
      </div>

      {/* Customer (all optional for ops) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Customer name (optional)
          </label>
          <input
            name="customerName"
            className="w-full rounded-md border p-2 text-sm"
            defaultValue="Not provided"
          />
          {firstError("customerName") ? (
            <p className="text-xs text-red-600">{firstError("customerName")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Customer email (optional)
          </label>
          <input
            type="email"
            name="customerEmail"
            defaultValue="ops@bookings.com"
            className="w-full rounded-md border p-2 text-sm"
          />
          {firstError("customerEmail") ? (
            <p className="text-xs text-red-600">
              {firstError("customerEmail")}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Customer phone (optional)
          </label>
          <input
            type="tel"
            name="customerPhone"
            defaultValue='"N/A"'
            className="w-full rounded-md border p-2 text-sm"
          />
          {firstError("customerPhone") ? (
            <p className="text-xs text-red-600">
              {firstError("customerPhone")}
            </p>
          ) : null}
        </div>
      </div>

      {/* Site address  */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-sm font-medium">Site address</label>
          <input
            name="siteAddressLine1"
            className="w-full rounded-md border p-2 text-sm"
          />
          {firstError("siteAddressLine1") ? (
            <p className="text-xs text-red-600">
              {firstError("siteAddressLine1")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium">City (optional)</label>
          <input
            name="siteAddressCity"
            className="w-full rounded-md border p-2 text-sm"
          />
          {firstError("siteAddressCity") ? (
            <p className="text-xs text-red-600">
              {firstError("siteAddressCity")}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Address Notes (optional)
          </label>
          <input
            name="siteAddressNotes"
            className="w-full rounded-md border p-2 text-sm"
          />
          {firstError("siteAddressNotes") ? (
            <p className="text-xs text-red-600">
              {firstError("siteAddressNotes")}
            </p>
          ) : null}
        </div>
      </div>

      {/* Financials + auth */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium">Total cost (EUR)</label>
          <input
            type="number"
            name="totalCost"
            step="0.01"
            inputMode="decimal"
            min="0"
            className="w-full rounded-md border p-2 text-sm"
            defaultValue="0"
          />
          {firstError("totalCost") ? (
            <p className="text-xs text-red-600">{firstError("totalCost")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">PASSCODE (REQUIRED)</label>
          <input
            type="password"
            name="opsPasscode"
            className="w-full rounded-md border p-2 text-sm"
            required
          />
          {firstError("opsPasscode") ? (
            <p className="text-xs text-red-600">{firstError("opsPasscode")}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create booking"}
        </button>
        {!success && result && !result.ok ? (
          <span className="text-xs text-gray-600">
            Fix the fields highlighted above.
          </span>
        ) : null}
      </div>
    </form>
  );
}
