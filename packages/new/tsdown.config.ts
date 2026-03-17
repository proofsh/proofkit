import { defineConfig } from "tsdown";

const isDev = process.env.npm_lifecycle_event === "dev";

export default defineConfig({
  clean: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  minify: !isDev,
  target: "esnext",
  outDir: "dist",
  nodeProtocol: false,
  onSuccess: isDev ? "node dist/index.js" : undefined,
});
