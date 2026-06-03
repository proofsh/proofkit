import type { AppType } from "~/core/types.js";
import type { PackageManager } from "~/utils/packageManager.js";
import { getTemplatePackageExecuteCommand, parseCommandString } from "~/utils/projectFiles.js";

const ULTRACITE_EDITORS = ["cursor"] as const;
const ULTRACITE_AGENTS = ["claude", "codex"] as const;
const ULTRACITE_HOOKS = ["cursor", "windsurf"] as const;
const ULTRACITE_INIT_PACKAGE = "ultracite@^7";

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
      ULTRACITE_INIT_PACKAGE,
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
      ...(skipInstall ? ["--skip-install"] : []),
    ],
  };
}

export function getBrowserOxlintConfig() {
  return `import { defineConfig } from "oxlint";
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

export function getWebViewerOxlintConfig() {
  return `import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
\textends: [core, react],
\trules: {
\t\t"react/react-in-jsx-scope": "off",
\t},
});
`;
}

export function getHuskyPreCommitHook() {
  return `#!/bin/sh
echo "Running lint-staged..."
pnpm exec lint-staged
`;
}
