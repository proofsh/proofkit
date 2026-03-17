import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Exclude E2E tests that require real credentials
    exclude: ["**/node_modules/**", "**/dist/**", "tests/browser-apps.test.ts"],
    testTimeout: 60_000, // 60 seconds for CLI tests which can be slow
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
    },
  },
});
