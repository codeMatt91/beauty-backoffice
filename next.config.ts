import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  eslint: {
    // Pre-existing lint debt across the repo (unrelated to any given change)
    // shouldn't block production builds. `npm run lint` still runs ESLint
    // for local/CI feedback; this only affects `next build`.
    ignoreDuringBuilds: true,
  },
  // Vercel Cron Jobs configuration
  // Definito in vercel.json – qui solo per documentazione
};

export default nextConfig;
