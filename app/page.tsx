import { getMachines } from "@/lib/data";
import { HomeView } from "@/components/home-view";
import { serializeMachines } from "@/lib/serializers";

// Revalidate the homepage HTML/data every 5 minutes to cut server work.
// Safe because the catalog doesn't change every request and webhooks/bookings
// do not mutate the home payload.
export const revalidate = 300;
// If we run promos or rapid price tweaks later, we can drop this to 60 or wire a revalidate tag.

export default async function Home() {
  const machines = await getMachines();
  const serializableMachines = serializeMachines(machines);
  return <HomeView machines={serializableMachines} />;
}
