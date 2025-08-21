import { getMachines } from "@/lib/data";
import { HomeView } from "@/components/home-view";
import { serializeMachines } from "@/lib/serializers"; // new import

export default async function Home() {
  const machines = await getMachines();
  const serializableMachines = serializeMachines(machines); // use shared util
  return <HomeView machines={serializableMachines} />;
}
