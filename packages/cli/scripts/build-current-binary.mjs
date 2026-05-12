import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const target = `bun-${process.platform}-${process.arch}`;

const result = spawnSync("node", ["./scripts/build-binaries.mjs"], {
  cwd: packageRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PROOFKIT_BINARY_TARGETS: target,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
