import { db } from "./db";

export async function getMachines() {
  try {
    const machines = await db.machine.findMany();
    return machines;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch machine data.");
  }
}
