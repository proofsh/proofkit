import path from "node:path";
import type { PackageJson } from "type-fest";

import type { InitPlan, InitRequest, ProofKitSettings } from "~/core/types.js";
import { formatPackageManagerCommand, getScaffoldVersion, getTemplatePackageCommand } from "~/utils/projectFiles.js";
import { getNodeMajorVersion, getProofkitReleaseTag } from "~/utils/versioning.js";

function createDefaultSettings(request: InitRequest): ProofKitSettings {
  return {
    ui: request.ui,
    appType: request.appType,
    envFile: ".env",
    dataSources: [],
    replacedMainPage: false,
    registryTemplates: [],
  };
}

function createEnvFileContent() {
  return ["# When adding additional environment variables, update the schema alongside this file.", ""].join("\n");
}

const sharedUiDependencies = {
  "@radix-ui/react-slot": "^1.2.3",
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  "lucide-react": "^0.577.0",
  "tailwind-merge": "^3.5.0",
  tailwindcss: "^4.1.10",
  "tw-animate-css": "^1.4.0",
} satisfies Record<string, string>;

export function planInit(
  request: InitRequest,
  options: { templateDir: string; packageManagerVersion?: string },
): InitPlan {
  const targetDir = path.resolve(request.cwd, request.appDir);
  const releaseTag = getProofkitReleaseTag();
  const settings = createDefaultSettings(request);
  const packageManagerCommand = getTemplatePackageCommand(request.packageManager);

  const packageJson: InitPlan["packageJson"] = {
    name: request.scopedAppName,
    packageManager: options.packageManagerVersion
      ? `${request.packageManager}@${options.packageManagerVersion}`
      : undefined,
    proofkitMetadata: {
      initVersion: getScaffoldVersion(),
      scaffoldPackage: "@proofkit/cli",
    },
    dependencies: {},
    devDependencies: {
      "@proofkit/cli": releaseTag,
      "@types/node": `^${getNodeMajorVersion()}`,
    },
  };

  if (request.appType === "browser") {
    Object.assign(packageJson.dependencies, sharedUiDependencies);
    packageJson.dependencies["@tailwindcss/postcss"] = "^4.1.10";
    packageJson.dependencies["next-themes"] = "^0.4.6";
  }

  if (request.appType === "webviewer") {
    Object.assign(packageJson.dependencies, sharedUiDependencies);
    packageJson.dependencies["@proofkit/fmdapi"] = releaseTag;
    packageJson.dependencies["@proofkit/webviewer"] = releaseTag;
    packageJson.dependencies["@tanstack/react-query"] = "^5.90.21";
    packageJson.dependencies["@tanstack/react-router"] = "^1.167.4";
    packageJson.dependencies.zod = "^4";
    packageJson.devDependencies["@proofkit/typegen"] = releaseTag;
    packageJson.devDependencies["@tailwindcss/vite"] = "^4.2.1";
    packageJson.devDependencies.ultracite = "7.0.8";
  }

  return {
    request,
    targetDir,
    templateDir: options.templateDir,
    packageManagerCommand,
    packageJson,
    settings,
    envFile: {
      path: path.join(targetDir, ".env"),
      content: createEnvFileContent(),
    },
    writes: [],
    commands: [
      ...(request.noInstall ? [] : [{ type: "install" as const }]),
      ...(request.dataSource === "filemaker" &&
      !request.skipFileMakerSetup &&
      !(request.appType === "webviewer" && request.nonInteractive && !request.hasExplicitFileMakerInputs)
        ? [{ type: "codegen" as const }]
        : []),
      ...(request.noGit ? [] : [{ type: "git-init" as const }]),
    ],
    tasks: {
      bootstrapFileMaker: request.dataSource === "filemaker" && !request.skipFileMakerSetup,
      runInstall: !request.noInstall,
      runInitialCodegen:
        request.dataSource === "filemaker" &&
        !request.skipFileMakerSetup &&
        !(request.appType === "webviewer" && request.nonInteractive && !request.hasExplicitFileMakerInputs),
      initializeGit: !request.noGit,
    },
    nextSteps: [
      `cd ${request.appDir}`,
      ...(request.noInstall ? [request.packageManager === "yarn" ? "yarn" : `${request.packageManager} install`] : []),
      "npx @tanstack/intent@latest install",
      formatPackageManagerCommand(request.packageManager, "dev"),
      ...(request.appType === "webviewer"
        ? [
            formatPackageManagerCommand(request.packageManager, "typegen"),
            formatPackageManagerCommand(request.packageManager, "launch-fm"),
          ]
        : []),
      formatPackageManagerCommand(request.packageManager, "proofkit"),
    ],
  };
}

export function applyPackageJsonMutations(
  packageJson: PackageJson,
  mutations: InitPlan["packageJson"],
  overwriteDependencies = true,
) {
  packageJson.name = mutations.name;
  packageJson.proofkitMetadata = mutations.proofkitMetadata as PackageJson["proofkitMetadata"];
  if (mutations.packageManager) {
    packageJson.packageManager = mutations.packageManager;
  }

  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  const merge = (target: Record<string, string>, source: Record<string, string>) => {
    for (const [name, version] of Object.entries(source)) {
      if (overwriteDependencies || !(name in target)) {
        target[name] = version;
      }
    }
  };

  merge(packageJson.dependencies as Record<string, string>, mutations.dependencies);
  merge(packageJson.devDependencies as Record<string, string>, mutations.devDependencies);

  return packageJson;
}
