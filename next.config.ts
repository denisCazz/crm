import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce .next/standalone + .next/static for the Docker image
  output: "standalone",
};

export default nextConfig;
