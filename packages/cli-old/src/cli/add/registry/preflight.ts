import path from "node:path";
import fs from "fs-extra";

import { stealthInit } from "~/helpers/stealth-init.js";
import { state } from "~/state.js";

export async function preflightAddCommand() {
  const cwd = state.projectDir ?? process.cwd();
  // make sure shadcn is installed, throw if not
  const shadcnInstalled = await fs.pathExists(path.join(cwd, "components.json"));
  if (!shadcnInstalled) {
    throw new Error("Shadcn is not installed. Please run `pnpm dlx shadcn@latest init` to install it.");
  }

  // if proofkit is not inited, try to stealth init
  await stealthInit();
}
