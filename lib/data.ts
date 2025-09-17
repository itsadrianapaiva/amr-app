import { db } from "./db";
import { unstable_noStore as noStore } from "next/cache";
import { hideInternalForCatalog } from "./visibility";

export async function getMachines() {
  noStore();
  try {
    const machines = await db.machine.findMany();
    return hideInternalForCatalog(machines); // ➌ remove “ZZZ / TEST / Do Not Rent”
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch machine data.");
  }
}

export async function getMachineById(id: number) {
  noStore();
  try {
    const machine = await db.machine.findUnique({
      where: { id },
    });
    return machine;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch machine.");
  }
}
