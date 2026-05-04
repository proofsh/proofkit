import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();
// validateRegistry();

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["typescript", "twoslash", "shiki"],
  transpilePackages: ["@proofkit/fmdapi", "@proofkit/typegen"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  webpack: (config) => {
    // Resolve @proofkit/typegen/config to source files for development
    config.resolve.alias = {
      ...config.resolve.alias,
      "@proofkit/typegen/config": require.resolve("@proofkit/typegen/src/types.ts"),
    };
    return config;
  },
};

export default withMDX(config);
