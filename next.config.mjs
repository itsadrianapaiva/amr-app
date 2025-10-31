/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Use the experimental field for older Next versions
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  allowedDevOrigins: [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:8888",
    "http://localhost:8888",
    "http://127.0.0.1",
  ],

  images: {
    /**
     * Re-enable AVIF with WebP fallback.
     * AVIF yields smaller bytes for photographic assets; if a given environment
     * ever struggles with AVIF encoding, Next.js will transparently serve WebP/JPEG.
     */
    formats: ["image/avif", "image/webp"],

    // PERF-TUNING v2025-10-31: Tightened deviceSizes to match actual breakpoints
    // to prevent serving oversized images to mobile devices. Previous range was too broad.
    // Mobile: 375, Small tablet: 640, Tablet: 768, Laptop: 1024, Desktop: 1280, Large: 1600
    deviceSizes: [375, 640, 768, 1024, 1280, 1600],

    // PERF-TUNING v2025-10-31: Optimized imageSizes for small inline assets (logos, icons)
    imageSizes: [16, 32, 48, 64, 96, 128, 256],

    // PERF-TUNING v2025-10-31: Increased quality slightly from default 75 to 80
    // to maintain visual fidelity with AVIF compression
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year for immutable assets
    // unoptimized: true, // Safety valve if you need to disable optimizer temporarily
  },
};

export default nextConfig;
