/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don't run ESLint during `next build` (and don't require the package)
    ignoreDuringBuilds: true,
  },
  // Optional: silence the dev-origin warnings
  allowedDevOrigins: [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:8888",
    "http://localhost:8888",
    "http://127.0.0.1",
  ],
};

export default nextConfig;
