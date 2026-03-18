import fs from "node:fs";
import path from "node:path";
import type { PostInstallStep } from "@proofkit/registry";

import { state } from "~/state.js";

export function addScriptToPackageJson(step: Extract<PostInstallStep, { action: "package.json script" }>) {
  const packageJsonPath = path.join(state.projectDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.scripts[step.data.scriptName] = step.data.scriptCommand;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}
