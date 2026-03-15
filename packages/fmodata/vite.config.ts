import { tanstackViteConfig } from "@tanstack/vite-config";
import { defineConfig, mergeConfig } from "vite";

const config = defineConfig({
  plugins: [],
});

export default mergeConfig(
  config,
  tanstackViteConfig({
    entry: ["./src/index.ts", "./src/testing.ts"],
    srcDir: "./src",
    cjs: false,
    outDir: "./dist",
  }),
);
