import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: deployable to Cloudflare Pages or GitHub Pages for free.
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
