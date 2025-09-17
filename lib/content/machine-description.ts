/**
 * Builds richer, human-friendly description text for a machine.
 * - Uses existing `machine.description` if present, then appends concise, useful details.
 * - Infers "ideal for" from category/type.
 * - Adds capacity snippets only when the numeric fields exist.
 *
 * Keep the output short, scannable, and ad-ready.
 */

export type MachineForDescription = {
    name?: string | null;
    description?: string | null;
    category?: string | null;
    type?: string | null;
  
    // Optional numeric hints. Only used when present.
    liftCapacityKg?: number | null;   // telehandler, forklift
    maxLiftHeightM?: number | null;   // telehandler boom height
    digDepthM?: number | null;        // excavators
    bucketWidthMm?: number | null;    // excavators, skid buckets
    operatingWeightKg?: number | null;
    widthMm?: number | null;          // transport / gateway width
    powerKw?: number | null;
    fuel?: string | null;             // "Diesel", "Electric", etc.
  };
  
  type U = string | number | null | undefined;
  
  function nonEmpty(x: U) {
    return x !== null && x !== undefined && String(x).trim() !== "";
  }
  
  function fmtInt(n?: number | null) {
    if (!nonEmpty(n)) return "";
    return Math.round(Number(n)).toLocaleString("en-PT");
  }
  
  function fmtKg(n?: number | null) {
    const v = fmtInt(n);
    return v ? `${v} kg` : "";
  }
  
  function fmtMm(n?: number | null) {
    const v = fmtInt(n);
    return v ? `${v} mm` : "";
  }
  
  function fmtM(n?: number | null) {
    if (!nonEmpty(n)) return "";
    const val = Number(n);
    // Keep one decimal if needed
    const s = Number.isInteger(val) ? `${val}` : val.toFixed(1);
    return `${s} m`;
  }
  
  function sentence(parts: Array<string | false | undefined>) {
    const txt = parts.filter(Boolean).join(" ");
    return txt ? txt.endsWith(".") ? txt : `${txt}.` : "";
  }
  
  function typeKey(m: MachineForDescription) {
    const t = (m.category || m.type || "").toLowerCase();
    // Normalize a few common aliases
    if (t.includes("tele")) return "telehandler";
    if (t.includes("excav")) return "excavator";
    if (t.includes("mini") && t.includes("excav")) return "mini-excavator";
    if (t.includes("skid")) return "skid-steer";
    if (t.includes("roller")) return "roller";
    if (t.includes("compactor")) return "compactor";
    if (t.includes("backhoe")) return "backhoe";
    if (t.includes("fork")) return "forklift";
    return t || "machine";
  }
  
  const IDEAL_FOR: Record<string, string> = {
    "mini-excavator":
      "Best for tight-access digs, trenching for utilities, and small landscaping jobs.",
    excavator:
      "Suited for trenching, foundations, and general earthmoving on small to medium sites.",
    "skid-steer":
      "Great for landscaping, site cleanup, pallet moves with forks, and tight yards.",
    telehandler:
      "Ideal for loading pallets, lifting materials to upper floors, and stock handling on uneven ground.",
    forklift:
      "Perfect for pallet handling on flat yards, warehouses, and loading bays.",
    backhoe:
      "Versatile for digging, trenching, and on-site loading with quick change between bucket and loader.",
    roller:
      "For compacting sub-base and asphalt on driveways, yards, and small roads.",
    compactor:
      "For soil and paver compaction in driveways, patios, and trenches.",
    machine:
      "Built for reliable day-to-day work on site with simple controls and easy transport.",
  };
  
  export function buildMachineDescription(raw: unknown): string {
    // Defensive read without 'any'
    const m = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as MachineForDescription;
  
    const base = typeof m.description === "string" ? m.description.trim() : "";
    const name = typeof m.name === "string" ? m.name.trim() : "";
    const tkey = IDEAL_FOR[typeKey(m)] ? typeKey(m) : "machine";
  
    const fuel = typeof m.fuel === "string" ? m.fuel : undefined;
  
    // Capacity snippets (only when values exist)
    const lift = nonEmpty(m.liftCapacityKg) ? `Lifts up to ${fmtKg(m.liftCapacityKg)}` : "";
    const liftHeight = nonEmpty(m.maxLiftHeightM) ? `to ${fmtM(m.maxLiftHeightM)}` : "";
    const dig = nonEmpty(m.digDepthM) ? `Dig depth up to ${fmtM(m.digDepthM)}` : "";
    const bucket = nonEmpty(m.bucketWidthMm) ? `Bucket ${fmtMm(m.bucketWidthMm)}` : "";
    const width = nonEmpty(m.widthMm) ? `Overall width ${fmtMm(m.widthMm)} for gateways and narrow access` : "";
    const weight = nonEmpty(m.operatingWeightKg) ? `Operating weight approx. ${fmtKg(m.operatingWeightKg)}` : "";
    const power = nonEmpty(m.powerKw) ? `Power ${m.powerKw} kW` : "";
  
    const lines: string[] = [];
  
    // 1) Keep your existing text if present
    if (base) lines.push(sentence([base]));
  
    // 2) Add ideal use case from type
    lines.push(sentence([IDEAL_FOR[tkey]]));
  
    // 3) Add capacity summary tailored to common types
    if (tkey === "telehandler" || tkey === "forklift") {
      lines.push(sentence([lift, liftHeight || "", fuel && `(${fuel})`]));
    } else if (tkey.includes("excavator")) {
      lines.push(sentence([dig || "", bucket || "", weight || ""]));
    } else if (tkey === "skid-steer") {
      lines.push(sentence([bucket || "", weight || "", fuel && `(${fuel})`]));
    } else {
      // Generic
      lines.push(sentence([lift || dig || weight || power || "", bucket || "", width || ""]));
    }
  
    // 4) Access/transport hint if we have width
    if (width && !lines.some((l) => l.includes("Overall width"))) {
      lines.push(sentence([width]));
    }
  
    // 5) Name nudge only if nothing else produced text
    if (!lines.filter(Boolean).length && name) {
      lines.push(`${name} ready for work.`);
    }
  
    // Final tidy: join unique sentences, remove empties
    const out = Array.from(new Set(lines.filter((l) => l && l.trim()))).join(" ");
    return out.trim();
  }
  