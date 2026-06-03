import path from "node:path";

import { getAgentInstructions } from "~/consts.js";
import { installPackages } from "~/helpers/installPackages.js";
import { scaffoldProject } from "~/helpers/scaffoldProject.js";
import type { AvailableDependencies } from "~/installers/dependencyVersionMap.js";
import type { PkgInstallerMap } from "~/installers/index.js";
import { state } from "~/state.js";
import { addPackageDependency } from "~/utils/addPackageDependency.js";
import { getUserPkgManager } from "~/utils/getUserPkgManager.js";
import { replaceTextInFiles } from "./replaceText.js";

interface CreateProjectOptions {
  projectName: string;
  packages: PkgInstallerMap;
  scopedAppName: string;
  noInstall: boolean;
  force: boolean;
  appRouter: boolean;
}

export const createBareProject = async ({
  projectName,
  scopedAppName,
  packages,
  noInstall,
  force,
}: CreateProjectOptions) => {
  const pkgManager = getUserPkgManager();
  state.projectDir = path.resolve(process.cwd(), projectName);

  // Bootstraps the base Next.js application
  await scaffoldProject({
    projectName,
    pkgManager,
    scopedAppName,
    noInstall,
    force,
  });

  addPackageDependency({
    dependencies: ["@types/node"],
    devMode: true,
  });

  // Add base deps for current templates. Legacy Mantine projects remain supported elsewhere.
  const NEXT_SHADCN_BASE_DEPS = [
    "@radix-ui/react-slot",
    "@tailwindcss/postcss",
    "class-variance-authority",
    "clsx",
    "lucide-react",
    "tailwind-merge",
    "tailwindcss",
    "tw-animate-css",
    "next-themes",
  ] as AvailableDependencies[];
  const VITE_SHADCN_BASE_DEPS = [
    "@radix-ui/react-slot",
    "@tailwindcss/vite",
    "@proofkit/fmdapi",
    "@proofkit/webviewer",
    "class-variance-authority",
    "clsx",
    "lucide-react",
    "tailwind-merge",
    "tailwindcss",
    "tw-animate-css",
    "zod",
  ] as AvailableDependencies[];
  const SHADCN_BASE_DEV_DEPS = ["oxlint", "ultracite"] as AvailableDependencies[];
  const VITE_SHADCN_BASE_DEV_DEPS = ["@proofkit/typegen", "oxlint", "ultracite"] as AvailableDependencies[];

  if (state.ui === "shadcn") {
    addPackageDependency({
      dependencies: state.appType === "webviewer" ? VITE_SHADCN_BASE_DEPS : NEXT_SHADCN_BASE_DEPS,
      devMode: false,
    });
    addPackageDependency({
      dependencies: state.appType === "webviewer" ? VITE_SHADCN_BASE_DEV_DEPS : SHADCN_BASE_DEV_DEPS,
      devMode: true,
    });
  } else {
    throw new Error(`Unsupported scaffold UI library: ${state.ui}`);
  }

  // Install the selected packages
  installPackages({
    projectName,
    scopedAppName,
    pkgManager,
    packages,
    noInstall,
  });

  let pkgManagerCommand: string;
  if (pkgManager === "pnpm") {
    pkgManagerCommand = "pnpm";
  } else if (pkgManager === "bun") {
    pkgManagerCommand = "bun";
  } else if (pkgManager === "yarn") {
    pkgManagerCommand = "yarn";
  } else {
    pkgManagerCommand = "npm run";
  }

  replaceTextInFiles(state.projectDir, "__PNPM_COMMAND__", pkgManagerCommand);
  replaceTextInFiles(state.projectDir, "__PACKAGE_MANAGER__", pkgManager);
  replaceTextInFiles(state.projectDir, "__AGENT_INSTRUCTIONS__", getAgentInstructions());

  return state.projectDir;
};
