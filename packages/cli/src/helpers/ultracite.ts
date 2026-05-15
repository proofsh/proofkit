import type { AppType } from "~/core/types.js";
import type { PackageManager } from "~/utils/packageManager.js";
import { getTemplatePackageExecuteCommand, parseCommandString } from "~/utils/projectFiles.js";

const ULTRACITE_EDITORS = ["universal", "cursor"] as const;
const ULTRACITE_AGENTS = ["universal", "claude", "codex"] as const;
const ULTRACITE_HOOKS = ["cursor", "windsurf", "codebuddy", "claude"] as const;
const ULTRACITE_INTEGRATIONS = ["husky", "lint-staged"] as const;

function splitExecuteCommand(packageManager: PackageManager) {
  const [command, ...args] = parseCommandString(getTemplatePackageExecuteCommand(packageManager));
  if (!command) {
    throw new Error(`Unable to resolve package execute command for ${packageManager}.`);
  }
  return { command, args };
}

export function getUltraciteFrameworks(appType: AppType) {
  return appType === "browser" ? ["react", "next"] : ["react"];
}

export function getUltraciteInitCommand({
  appType,
  packageManager,
  skipInstall,
}: {
  appType: AppType;
  packageManager: PackageManager;
  skipInstall: boolean;
}) {
  const execute = splitExecuteCommand(packageManager);
  return {
    command: execute.command,
    args: [
      ...execute.args,
      "ultracite",
      "init",
      "--quiet",
      "--linter",
      "oxlint",
      "--pm",
      packageManager,
      "--frameworks",
      ...getUltraciteFrameworks(appType),
      "--editors",
      ...ULTRACITE_EDITORS,
      "--agents",
      ...ULTRACITE_AGENTS,
      "--hooks",
      ...ULTRACITE_HOOKS,
      "--integrations",
      ...ULTRACITE_INTEGRATIONS,
      ...(skipInstall ? ["--skip-install"] : []),
    ],
  };
}

export function getBrowserOxlintConfig() {
  return `// @ts-nocheck
import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
\textends: [core, react, next],
\trules: {
\t\t"func-style": "off",
\t\t"next/no-img-element": "off",
\t\t"promise/prefer-await-to-then": "off",
\t\t"promise/prefer-catch": "off",
\t\t"unicorn/filename-case": "off",
\t},
});
`;
}
