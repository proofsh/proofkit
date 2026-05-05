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
  redirects: async () => [
    {
      source: "/docs",
      destination: "/docs/ai",
      permanent: false,
    },
    {
      source: "/docs/hybrid-apps/:path*",
      destination: "/docs/webviewer/:path*",
      permanent: true,
    },
    {
      source: "/docs/cli/webviewer/overview",
      destination: "/docs/webviewer/faq",
      permanent: true,
    },
    {
      source: "/docs/cli/webviewer/:path*",
      destination: "/docs/webviewer/:path*",
      permanent: true,
    },
  ],
  rewrites: async () => [
    {
      source: "/docs/:path*.mdx",
      destination: "/llms.mdx/docs/:path*",
    },
  ],
};

export default withMDX(config);
