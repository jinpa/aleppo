import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // R2 storage (production images)
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "pub-*.r2.dev" },
      // Google OAuth avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Any external recipe site — used for the import preview before re-upload to R2
      { protocol: "https", hostname: "**" },
    ],
  },
  serverExternalPackages: ["sharp", "postgres"],
  experimental: {
    // Paprika export files can exceed the default 10MB limit (e.g. 870 recipes ≈ 38MB)
    middlewareClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
