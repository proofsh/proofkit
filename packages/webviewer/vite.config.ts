import { tanstackViteConfig } from "@tanstack/vite-config";
import { defineConfig, mergeConfig } from "vite";

const config = defineConfig({
  plugins: [],
});

export default mergeConfig(
  config,
  tanstackViteConfig({
    entry: ["./src/main.ts", "./src/adapter.ts", "./src/vite-plugins.ts"],
    externalDeps: ["@proofkit/fmdapi"],
    srcDir: "./src",
  }),
);
