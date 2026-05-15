import type { PackageManager } from "~/utils/packageManager.js";
import { getTemplatePackageExecuteCommand } from "~/utils/projectFiles.js";

function splitExecuteCommand(packageManager: PackageManager) {
  const [command, ...args] = getTemplatePackageExecuteCommand(packageManager).split(" ");
  if (!command) {
    throw new Error(`Unable to resolve package execute command for ${packageManager}.`);
  }
  return { command, args };
}

export function getIntentInstallCommand(packageManager: PackageManager) {
  const execute = splitExecuteCommand(packageManager);
  return {
    command: execute.command,
    args: [...execute.args, "@tanstack/intent@latest", "install"],
  };
}
