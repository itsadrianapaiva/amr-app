import "server-only";
import { toPt } from "@/lib/ops/date";
import type { AvailabilityByMachine } from "@/lib/ops/availability";

/**
 * Compact list of machines and their bookings.
 * Renders: DD-MM-YYYY → DD-MM-YYYY • customer • site
 */
export default function AvailabilityList({
  machines,
}: {
  machines: AvailabilityByMachine[];
}) {
  if (!machines.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No confirmed bookings in this window.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {machines.map((m) => (
        <div key={m.machineId} className="rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">{m.machineName}</h3>
            <span className="text-xs text-muted-foreground">
              {m.bookings.length} booking{m.bookings.length === 1 ? "" : "s"}
            </span>
          </div>

          {m.bookings.length === 0 ? (
            <div className="text-sm text-muted-foreground">No bookings.</div>
          ) : (
            <ul className="flex flex-col gap-1">
              {m.bookings.map((b) => {
                const parts: string[] = [];
                if (b.siteAddressCity?.trim())
                  parts.push(b.siteAddressCity.trim());
                else if (b.siteAddressLine1?.trim())
                  parts.push(b.siteAddressLine1.trim());
                if (b.siteAddressPostalCode?.trim())
                  parts.push(b.siteAddressPostalCode.trim());
                const site = parts.join(" ");

                return (
                  <li
                    key={b.id}
                    className="text-xs rounded-md border px-2 py-1"
                    title={`Booking #${b.id}`}
                  >
                    <span className="font-medium">
                      {toPt(b.startYmd)} → {toPt(b.endYmd)}
                    </span>
                    <span className="mx-2 text-muted-foreground">•</span>
                    <span>{b.customerName}</span>
                    {site && (
                      <>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{site}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
