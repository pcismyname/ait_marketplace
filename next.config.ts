import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Demo images are static WebP files in /public and the sell form previews
    // blob: URLs, so the optimizer is disabled for this proof of concept.
    unoptimized: true,
  },
};

export default nextConfig;
