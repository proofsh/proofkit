import { type NextConfig } from "next";

// Import env here to validate during build.
import "./src/config/env";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
};

export default nextConfig;
