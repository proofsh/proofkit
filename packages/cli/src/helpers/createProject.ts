import path from "node:path";

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
  appRouter: boolean;
}

export const createBareProject = async ({ projectName, scopedAppName, packages, noInstall }: CreateProjectOptions) => {
  const pkgManager = getUserPkgManager();
  state.projectDir = path.resolve(process.cwd(), projectName);

  // Bootstraps the base Next.js application
  await scaffoldProject({
    projectName,
    pkgManager,
    scopedAppName,
    noInstall,
  });

  addPackageDependency({
    dependencies: ["@proofkit/cli", "@types/node"],
    devMode: true,
  });

  // Add new base dependencies for Tailwind v4 and shadcn/ui or legacy Mantine
  // These should match the plan and dependencyVersionMap
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
  const SHADCN_BASE_DEV_DEPS = [] as AvailableDependencies[];
  const VITE_SHADCN_BASE_DEV_DEPS = ["@proofkit/typegen"] as AvailableDependencies[];

  const MANTINE_DEPS = [
    "@mantine/core",
    "@mantine/dates",
    "@mantine/hooks",
    "@mantine/modals",
    "@mantine/notifications",
    "mantine-react-table",
  ] as AvailableDependencies[];
  const MANTINE_DEV_DEPS = ["postcss", "postcss-preset-mantine", "postcss-simple-vars"] as AvailableDependencies[];

  if (state.ui === "mantine") {
    addPackageDependency({
      dependencies: MANTINE_DEPS,
      devMode: false,
    });
    addPackageDependency({
      dependencies: MANTINE_DEV_DEPS,
      devMode: true,
    });
  } else if (state.ui === "shadcn") {
    addPackageDependency({
      dependencies: state.appType === "webviewer" ? VITE_SHADCN_BASE_DEPS : NEXT_SHADCN_BASE_DEPS,
      devMode: false,
    });
    addPackageDependency({
      dependencies: state.appType === "webviewer" ? VITE_SHADCN_BASE_DEV_DEPS : SHADCN_BASE_DEV_DEPS,
      devMode: true,
    });
  } else {
    throw new Error(`Unsupported UI library: ${state.ui}`);
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

  return state.projectDir;
};
