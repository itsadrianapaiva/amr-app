import { getMachines } from "@/lib/data";
import CatalogSection from "@/components/catalog-section";
import { serializeMachines } from "@/lib/serializers";

// Revalidate the catalog page HTML/data every 5 minutes to mirror the homepage behavior.
// Safe because the catalog doesn't change every request and webhooks/bookings
// do not mutate the catalog payload.
export const revalidate = 300;

export default async function CatalogPage() {
  const machines = await getMachines();
  const serializableMachines = serializeMachines(machines);
  return (
    <main>
      <CatalogSection machines={serializableMachines} />
    </main>
  );
}
