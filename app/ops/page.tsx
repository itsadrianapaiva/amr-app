import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createManagerBooking } from "@/app/ops/actions";

// Run on Node for server actions + googleapis downstream
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server action: read form data, call the shared action, redirect with result.
// Single responsibility: parse minimally, delegate validation to Zod in the action.
async function createFromForm(formData: FormData) {
  "use server";

  const passcode = String(formData.get("passcode") || "");
  const managerName = String(formData.get("managerName") || "OPS");
  const machineId = Number(formData.get("machineId") || 0);
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");

  // toggles
  const delivery = formData.get("delivery") === "on";
  const pickup = formData.get("pickup") === "on";
  const insurance = formData.get("insurance") === "on";
  const operator = formData.get("operator") === "on";

  // customer basics
  const customerName = String(formData.get("customerName") || "OPS Booking");
  const customerEmail = String(formData.get("customerEmail") || "ops@example.com");
  const customerPhone = String(formData.get("customerPhone") || "000000000");
  const customerNIF = formData.get("customerNIF")
    ? String(formData.get("customerNIF"))
    : undefined;

  // totals
  const totalCost = Number(formData.get("totalCost") || 0);

  // site address (map to object the action expects)
  const siteAddressLine1 = formData.get("siteAddressLine1")
    ? String(formData.get("siteAddressLine1"))
    : undefined;
  const siteAddressPostalCode = formData.get("siteAddressPostalCode")
    ? String(formData.get("siteAddressPostalCode"))
    : undefined;
  const siteAddressCity = formData.get("siteAddressCity")
    ? String(formData.get("siteAddressCity"))
    : undefined;
  const siteAddressNotes = formData.get("siteAddressNotes")
    ? String(formData.get("siteAddressNotes"))
    : undefined;

  const siteAddress =
    siteAddressLine1 || siteAddressPostalCode || siteAddressCity || siteAddressNotes
      ? {
          line1: siteAddressLine1,
          postalCode: siteAddressPostalCode,
          city: siteAddressCity,
          notes: siteAddressNotes,
        }
      : undefined;

  // Call the real action (Zod will validate and throw if invalid).
  const result = await createManagerBooking({
    passcode,
    managerName,
    machineId,
    startDate,
    endDate,
    delivery,
    pickup,
    insurance,
    operator,
    customerName,
    customerEmail,
    customerPhone,
    customerNIF,
    totalCost,
    siteAddress,
  });

  // Revalidate this page so the "recent bookings" list updates immediately.
  revalidatePath("/ops");

  if (result.ok) {
    redirect(`/ops?created=1&bookingId=${result.bookingId}`);
  } else {
    redirect(`/ops?error=1`);
  }
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams?: { created?: string; bookingId?: string; error?: string };
}) {
  // Fetch data server-side for the form and the list
  const [machines, bookings] = await Promise.all([
    db.machine.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.booking.findMany({
      take: 10,
      orderBy: { id: "desc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        machine: { select: { name: true, id: true } },
        googleCalendarEventId: true,
      },
    }),
  ]);

  const created = searchParams?.created === "1";
  const bookingId = searchParams?.bookingId;
  const hadError = searchParams?.error === "1";

  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Ops Console</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Passcode-gated internal booking. Calendar is written automatically.
      </p>

      {/* Alerts */}
      {created && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-50 text-green-900 px-4 py-2">
          Booking created successfully{bookingId ? ` (ID ${bookingId})` : ""}.
        </div>
      )}
      {hadError && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-900 px-4 py-2">
          Something went wrong creating the booking.
        </div>
      )}

      {/* Create Booking form */}
      <section className="mt-8">
        <h2 className="text-xl font-medium">Create Booking</h2>
        <form action={createFromForm} className="mt-4 grid gap-4">
          {/* Auth */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Passcode</label>
            <input
              name="passcode"
              type="password"
              required
              className="w-full rounded-md border px-3 py-2"
              placeholder="OPS_PASSCODE"
            />
          </div>

          {/* Manager + Machine */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Manager name</label>
              <input
                name="managerName"
                type="text"
                defaultValue="OPS"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-sm font-medium">Machine</label>
              <select name="machineId" required className="w-full rounded-md border px-3 py-2">
                <option value="">Select a machine…</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Start date</label>
              <input
                name="startDate"
                type="date"
                required
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">End date</label>
              <input
                name="endDate"
                type="date"
                required
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>

          {/* Add-ons */}
          <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "delivery", label: "Delivery" },
              { name: "pickup", label: "Pickup" },
              { name: "insurance", label: "Insurance" },
              { name: "operator", label: "Operator" },
            ].map((x) => (
              <label key={x.name} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name={x.name} />
                <span>{x.label}</span>
              </label>
            ))}
          </fieldset>

          {/* Site address */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="grid gap-1 md:col-span-2">
              <label className="text-sm font-medium">Site address line 1</label>
              <input name="siteAddressLine1" type="text" className="w-full rounded-md border px-3 py-2" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Postal code</label>
              <input name="siteAddressPostalCode" type="text" className="w-full rounded-md border px-3 py-2" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">City</label>
              <input name="siteAddressCity" type="text" className="w-full rounded-md border px-3 py-2" />
            </div>
            <div className="grid gap-1 md:col-span-4">
              <label className="text-sm font-medium">Notes</label>
              <input name="siteAddressNotes" type="text" className="w-full rounded-md border px-3 py-2" />
            </div>
          </div>

          {/* Customer basics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Customer name</label>
              <input name="customerName" type="text" defaultValue="OPS Booking" className="w-full rounded-md border px-3 py-2" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Customer email</label>
              <input name="customerEmail" type="email" defaultValue="ops@example.com" className="w-full rounded-md border px-3 py-2" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Customer phone</label>
              <input name="customerPhone" type="tel" defaultValue="000000000" className="w-full rounded-md border px-3 py-2" />
            </div>
            <div className="grid gap-1 md:col-span-3">
              <label className="text-sm font-medium">Customer NIF (optional)</label>
              <input name="customerNIF" type="text" className="w-full rounded-md border px-3 py-2" />
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Total cost (EUR)</label>
              <input name="totalCost" type="number" step="0.01" defaultValue={0} className="w-full rounded-md border px-3 py-2" />
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" className="rounded-md border bg-foreground px-4 py-2 text-background">
              Create booking
            </button>
          </div>
        </form>
      </section>

      {/* Recent bookings */}
      <section className="mt-12">
        <h2 className="text-xl font-medium mb-3">Recent bookings</h2>
        <div className="grid gap-2">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-md border px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">#{b.id}</span>
                <span>{b.machine?.name}</span>
                <span>
                  {b.startDate?.toISOString().slice(0, 10)} → {b.endDate?.toISOString().slice(0, 10)}
                </span>
                {b.googleCalendarEventId ? (
                  <span className="text-green-700">Calendar ✓</span>
                ) : (
                  <span className="text-amber-700">Calendar pending</span>
                )}
                {b.machine?.id ? (
                  <a href={`/machine/${b.machine.id}`} className="underline">
                    View machine
                  </a>
                ) : null}
              </div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-sm text-muted-foreground">No recent bookings.</p>}
        </div>
      </section>
    </main>
  );
}
