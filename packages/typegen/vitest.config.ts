import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@proofkit\/fmdapi$/,
        replacement: path.resolve(__dirname, "../fmdapi/src/index.ts"),
      },
      {
        find: /^@proofkit\/fmdapi\/adapters\/fetch$/,
        replacement: path.resolve(__dirname, "../fmdapi/src/adapters/fetch.ts"),
      },
      {
        find: /^@proofkit\/fmdapi\/adapters\/fm-mcp$/,
        replacement: path.resolve(__dirname, "../fmdapi/src/adapters/fm-mcp.ts"),
      },
      {
        find: /^@proofkit\/fmdapi\/adapters\/otto$/,
        replacement: path.resolve(__dirname, "../fmdapi/src/adapters/otto.ts"),
      },
      {
        find: /^@proofkit\/fmdapi\/tokenStore\/memory$/,
        replacement: path.resolve(__dirname, "../fmdapi/src/tokenStore/memory.ts"),
      },
      {
        find: /^@proofkit\/fmodata$/,
        replacement: path.resolve(__dirname, "../fmodata/src/index.ts"),
      },
    ],
  },
  test: {
    testTimeout: 15_000,
    setupFiles: ["./tests/setupEnv.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
});
