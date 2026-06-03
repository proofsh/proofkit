import { execSync } from "node:child_process";
import path, { join } from "node:path";
import dotenv from "dotenv";
import { beforeAll } from "vitest";

beforeAll(() => {
  // Ensure test environment variables are loaded
  dotenv.config({ path: path.resolve(import.meta.dirname, "../.env.test") });
  process.env.PROOFKIT_SKIP_VERSION_CHECK = "1";
});

// Build the CLI before running any tests
execSync("pnpm build", { cwd: join(import.meta.dirname, "..") });
