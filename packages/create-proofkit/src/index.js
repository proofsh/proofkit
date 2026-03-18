#!/usr/bin/env node

import { createRequire } from "node:module";
import { execa } from "execa";
import { createRequire } from "node:module";
import { getUserPkgManager } from "./getUserPkgManager.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

function getCliSpecifier() {
  const version = packageJson.version;
  const tag = version.includes("-") ? "beta" : "latest";

  return `@proofkit/cli@${tag}`;
}

async function main() {
  const args = process.argv.slice(2);

  const pkgManager = getUserPkgManager();
  let pkgManagerCmd;
  if (pkgManager === "pnpm") {
    pkgManagerCmd = "pnpx";
  } else if (pkgManager === "bun") {
    pkgManagerCmd = "bunx";
  } else if (pkgManager === "npm") {
    pkgManagerCmd = "npx";
  } else {
    pkgManagerCmd = pkgManager;
  }

  try {
    await execa(pkgManagerCmd, [getCliSpecifier(), "init", ...args], {
      stdio: "inherit",
      env: {
        ...process.env,
        FORCE_COLOR: "1", // Preserve colors in output
      },
    });
  } catch {
    console.error("Failed to create project");
    process.exit(1);
  }
}

main().catch(() => {
  console.error("Failed to create project");
  process.exit(1);
});
