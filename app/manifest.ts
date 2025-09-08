import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AMR — Machinery Rentals",
    short_name: "AMR Rentals",
    description: "Instant online booking for pro-grade machinery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
    icons: [
      // Keep this list minimal and real — only include files that actually exist.
      { src: "/icon0.svg", sizes: "any", type: "image/svg+xml" }
    ],
  };
}
