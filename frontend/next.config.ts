import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Run after filesystem routes - API routes will take precedence
      afterFiles: [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ],
    };
  },
  // Increase body size limit for server actions
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  // Note: Video uploads bypass the Next.js proxy and go directly to the backend
  // to avoid the 10MB body size limit for proxied requests (see api.ts uploadVideo)
};

export default nextConfig;
