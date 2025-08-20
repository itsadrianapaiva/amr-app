import { getMachines } from "@/lib/data";
import { HomeView } from "@/components/home-view";

export default async function Home() {
  const machines = await getMachines();

  return <HomeView machines={machines} />;
}
