import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./shims/canvas.js",
    },
  },
};

export default nextConfig;
