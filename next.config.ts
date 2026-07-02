import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  // Vercel Cron Jobs configuration
  // Definito in vercel.json – qui solo per documentazione
};

export default nextConfig;
