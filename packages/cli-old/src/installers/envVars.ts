import path from "node:path";
import fs from "fs-extra";

import type { Installer } from "~/installers/index.js";
import { state } from "~/state.js";
import { logger } from "~/utils/logger.js";

export type FMAuthKeys = { username: string; password: string } | { ottoApiKey: string };

export const initEnvFile: Installer = () => {
  const envFilePath = findT3EnvFile(false) ?? "./src/config/env.ts";

  const envContent = `
# When adding additional environment variables, the schema in "${envFilePath}"
# should be updated accordingly.

`
    .trim()
    .concat("\n");

  const envDest = path.join(state.projectDir, ".env");

  fs.writeFileSync(envDest, envContent, "utf-8");
};
export function findT3EnvFile(throwIfNotFound: false): string | null;
export function findT3EnvFile(throwIfNotFound?: true): string;
export function findT3EnvFile(throwIfNotFound?: boolean): string | null {
  const possiblePaths = ["src/config/env.ts", "src/lib/env.ts", "src/env.ts", "lib/env.ts", "env.ts", "config/env.ts"];

  for (const testPath of possiblePaths) {
    const fullPath = path.join(state.projectDir, testPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  if (throwIfNotFound === false) {
    return null;
  }

  logger.warn(`Could not find T3 env files. Run "proofkit add utils/t3-env" to initialize them.`);
  throw new Error("T3 env file not found");
}
