import type { NextConfig } from "next";

function ngrokDevOrigins(): string[] {
  const raw = process.env.NGROK_DOMAIN?.trim();
  if (!raw) return [];
  const host = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return host ? [host] : [];
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ngrokDevOrigins(),
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
