// Staging hotfix: Allow disabling image optimization via env flag
// Production does not set this flag and continues using /_next/image
const isUnoptimizedImages =
  process.env.NEXT_UNOPTIMIZED_IMAGES === "1" ||
  process.env.NEXT_UNOPTIMIZED_IMAGES?.toLowerCase() === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
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

    // Keep these aligned with our layouts to avoid wasteful variants.
    deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 256, 384],

    // Staging hotfix: disable image optimizer on staging via NEXT_UNOPTIMIZED_IMAGES env
    unoptimized: isUnoptimizedImages,
  },
};

export default nextConfig;
