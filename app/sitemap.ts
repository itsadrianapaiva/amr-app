import type { MetadataRoute } from "next";
import { getMachines } from "@/lib/data";

/**
 * Sitemap strategy:
 * - Absolute URLs using NEXT_PUBLIC_SITE_URL (falls back to example.com if missing).
 * - Static routes listed explicitly.
 * - Dynamic routes for machine detail pages at /machine/[id].
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://example.com";

  // Helper to build absolute URLs consistently
  const u = (path: string) => `${site}${path.startsWith("/") ? "" : "/"}${path}`;

  // Static routes (expand as needed)
  const staticRoutes = [
    { path: "/", priority: 1.0, changefreq: "daily" as const },
    { path: "/catalog", priority: 0.9, changefreq: "daily" as const },
    { path: "/legal/terms", priority: 0.2, changefreq: "yearly" as const },
    { path: "/legal/privacy", priority: 0.2, changefreq: "yearly" as const },
    { path: "/legal/cookies", priority: 0.2, changefreq: "yearly" as const },
  ];

  // Fetch machine IDs for dynamic detail pages (PRIMARY only, addons excluded)
  const machines = await getMachines();

  // NOTE: Machine model doesn’t expose updatedAt/createdAt;
  // we'll use a single consistent timestamp for this generation.
  const now = new Date().toISOString();

  // Map static pages
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: u(r.path),
    lastModified: now,
    changeFrequency: r.changefreq,
    priority: r.priority,
  }));

  // Map dynamic machine pages at /machine/[id]
  const machineEntries: MetadataRoute.Sitemap = machines.map((m) => ({
    url: u(`/machine/${m.id}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...machineEntries];
}
