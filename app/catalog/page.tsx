import { getMachines } from "@/lib/data";
import FullCatalogSection from "@/components/full-catalog-section";
import { serializeMachines } from "@/lib/serializers";
import HowToBook from "@/components/how-to-book";
import CatalogMetaViewContent from "@/components/analytics/catalog-meta-viewcontent";
import CatalogGa4ViewList from "@/components/analytics/catalog-ga4-viewlist";

// Revalidate the catalog page HTML/data every 60 seconds for faster feedback after DB updates.
// Balances performance (reduces DB load) with freshness (CSV updates visible within 1 minute).
// Catalog content changes infrequently, so this provides good cache hit ratio while ensuring
// machine name/image changes are reflected promptly after seeding.
export const revalidate = 60;

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
