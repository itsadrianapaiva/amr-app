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
    // AVIF encoders can 500 in some serverless setups.
    // Keep WebP (big win) and fall back to JPEG automatically.
    formats: ["image/webp"],

    // Keep these aligned with our layouts to avoid wasteful variants.
    deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    // unoptimized: true, // Safety valve if you need to disable optimizer temporarily
  },
};

export default nextConfig;
