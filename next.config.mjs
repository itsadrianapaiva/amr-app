// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don't run ESLint during `next build` (and don't require the package)
    ignoreDuringBuilds: true,
  },
  // Optional: silence the dev-origin warning you saw
  allowedDevOrigins: ["http://127.0.0.1:3000", "http://localhost:3000"],
};

export default nextConfig;
