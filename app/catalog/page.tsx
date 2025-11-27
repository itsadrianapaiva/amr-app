import { getMachines } from "@/lib/data";
import FullCatalogSection from "@/components/full-catalog-section";
import { serializeMachines } from "@/lib/serializers";
import HowToBook from "@/components/how-to-book";
import CatalogMetaViewContent from "@/components/analytics/catalog-meta-viewcontent";
import CatalogGa4ViewList from "@/components/analytics/catalog-ga4-viewlist";

// Revalidate the catalog page HTML/data every 5 minutes to mirror the homepage behavior.
// Safe because the catalog doesn't change every request and webhooks/bookings
// do not mutate the catalog payload.
export const revalidate = 300;

export default async function CatalogPage() {
  const machines = await getMachines();
  const serializableMachines = serializeMachines(machines);
  return (
    <main>
      <FullCatalogSection machines={serializableMachines} />
      {/* AMR: HowToBook section start */}
      <HowToBook />
      {/* Analytics tracking */}
      <CatalogMetaViewContent machines={serializableMachines} />
      <CatalogGa4ViewList machines={serializableMachines} />
    </main>
  );
}
