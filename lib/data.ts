import { db } from "./db";
import { unstable_noStore as noStore } from "next/cache";
import { filterInternalIfEnabled } from "./visibility";

export async function getMachines() {
  noStore();
  try {
    const machines = await db.machine.findMany({
      where: { itemType: "PRIMARY" },
    });
    return filterInternalIfEnabled(machines); // only hide ZZZ test product when HIDE_INTERNAL_LIST=1
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
