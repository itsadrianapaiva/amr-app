import { getMachines } from "@/lib/data";
import { HomeView } from "@/components/home-view";

export default async function Home() {
  const machines = await getMachines();

  // Convert Decimal fields to strings to make the data serializable
  const serializableMachines = machines.map((machine) => ({
    ...machine,
    dailyRate: machine.dailyRate.toString(),
    deposit: machine.deposit.toString(),
    deliveryCharge: machine.deliveryCharge.toString(),
  }));

  return <HomeView machines={serializableMachines} />;
}
