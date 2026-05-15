import path from "node:path";
import type { PackageJson } from "type-fest";

import { NODE_RUNTIME_VERSION } from "~/consts.js";
import type { InitPlan, InitRequest, ProofKitSettings } from "~/core/types.js";
import {
  getFmdapiVersion,
  getProofkitDependencyVersion,
  getProofkitWebviewerVersion,
  getTypegenVersion,
  getVersion,
} from "~/utils/getProofKitVersion.js";
import {
  formatPackageManagerCommand,
  getScaffoldVersion,
  getTemplatePackageCommand,
  getTemplatePackageExecuteCommand,
} from "~/utils/projectFiles.js";
import { getNodeMajorVersion } from "~/utils/versioning.js";

const SHARED_PNPM_BUILD_POLICY = {
  "@parcel/watcher": true,
  esbuild: true,
  "msgpackr-extract": true,
  msw: true,
} as const;
const NPM_PACKAGE_MANAGER_WARNING =
  "Warning: We strongly suggest using PNPM 11 or greater as your package manager to better protect your computer and your app.";
const NPM_MIN_RELEASE_AGE_DAYS = 1;

export function createPnpmWorkspaceFileContent(appType: InitRequest["appType"]) {
  const buildPolicy = {
    ...SHARED_PNPM_BUILD_POLICY,
    sharp: appType === "browser",
  } as const;

  return [
    "# This setting defines where in the repo your apps/packages that need installed dependancies exist. This of this as a list of paths to your package.json files. ",
    "packages:",
    '  - "."',
    "",
    "allowBuilds:",
    ...Object.entries(buildPolicy).map(([packageName, allowed]) => `  ${JSON.stringify(packageName)}: ${allowed}`),
    "",
    "trustPolicy: no-downgrade",
    "",
    "trustPolicyIgnoreAfter: 43200",
    "",
    "blockExoticSubdeps: true",
    "",
  ].join("\n");
}

export function createNpmrcFileContent() {
  return [
    "# Require npm package releases to be at least 24 hours old before install.",
    `min-release-age=${NPM_MIN_RELEASE_AGE_DAYS}`,
    "",
  ].join("\n");
}

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
  "lucide-react": "^1.16.0",
  "tailwind-merge": "^3.5.0",
  tailwindcss: "^4.1.10",
  "tw-animate-css": "^1.4.0",
} satisfies Record<string, string>;

export function planInit(
  request: InitRequest,
  options: { templateDir: string; packageManagerVersion?: string },
): InitPlan {
  const targetDir = path.resolve(request.cwd, request.appDir);
  const proofkitCliVersion = getProofkitDependencyVersion(getVersion());
  const proofkitFmdapiVersion = getProofkitDependencyVersion(getFmdapiVersion());
  const proofkitTypegenVersion = getProofkitDependencyVersion(getTypegenVersion());
  const proofkitWebviewerVersion = getProofkitDependencyVersion(getProofkitWebviewerVersion());
  const settings = createDefaultSettings(request);
  const packageManagerCommand = getTemplatePackageCommand(request.packageManager);
  const packageManagerExecuteCommand = getTemplatePackageExecuteCommand(request.packageManager);
  const shouldWritePnpmWorkspaceFile = request.packageManager === "pnpm";
  const shouldWriteNpmrcFile = request.packageManager === "npm";

  const packageJson: InitPlan["packageJson"] = {
    name: request.scopedAppName,
    engines: {
      node: NODE_RUNTIME_VERSION,
    },
    devEngines: options.packageManagerVersion
      ? {
          packageManager: {
            name: request.packageManager,
            version: options.packageManagerVersion,
            onFail: "download",
          },
          runtime: {
            name: "node",
            version: NODE_RUNTIME_VERSION,
            onFail: "download",
          },
        }
      : undefined,
    proofkitMetadata: {
      initVersion: getScaffoldVersion(),
      scaffoldPackage: "@proofkit/cli",
    },
    dependencies: {},
    devDependencies: {
      "@proofkit/cli": proofkitCliVersion,
      "@types/node": `^${getNodeMajorVersion()}`,
    },
  };

  if (request.appType === "browser") {
    packageJson.devDependencies["@proofkit/typegen"] = proofkitTypegenVersion;
    Object.assign(packageJson.dependencies, sharedUiDependencies);
    packageJson.dependencies["@tailwindcss/postcss"] = "^4.1.10";
    packageJson.dependencies["next-themes"] = "^0.4.6";
    if (request.dataSource === "filemaker") {
      packageJson.dependencies["@proofkit/fmdapi"] = proofkitFmdapiVersion;
      packageJson.dependencies.zod = "^4";
    }
  }

  if (request.appType === "webviewer") {
    Object.assign(packageJson.dependencies, sharedUiDependencies);
    packageJson.dependencies["@proofkit/fmdapi"] = proofkitFmdapiVersion;
    packageJson.dependencies["@proofkit/webviewer"] = proofkitWebviewerVersion;
    packageJson.dependencies["@tanstack/react-query"] = "^5.90.21";
    packageJson.dependencies["@tanstack/react-router"] = "^1.167.4";
    packageJson.dependencies.zod = "^4";
    packageJson.devDependencies["@proofkit/typegen"] = proofkitTypegenVersion;
    packageJson.devDependencies["@tailwindcss/vite"] = "^4.2.1";
    packageJson.devDependencies.ultracite = "7.0.8";
  }

  const shouldRunInitialCodegen =
    !request.noInstall &&
    request.dataSource === "filemaker" &&
    !request.skipFileMakerSetup &&
    !(request.appType === "webviewer" && request.nonInteractive && !request.hasExplicitFileMakerInputs);

  return {
    request,
    targetDir,
    templateDir: options.templateDir,
    packageManagerCommand,
    packageManagerExecuteCommand,
    packageJson,
    settings,
    envFile: {
      path: path.join(targetDir, ".env"),
      content: createEnvFileContent(),
    },
    writes: [
      {
        path: path.join(targetDir, ".cursorignore"),
        content: "CLAUDE.md\n",
      },
      ...(shouldWritePnpmWorkspaceFile
        ? [
            {
              path: path.join(targetDir, "pnpm-workspace.yaml"),
              content: createPnpmWorkspaceFileContent(request.appType),
            },
          ]
        : []),
      ...(shouldWriteNpmrcFile
        ? [
            {
              path: path.join(targetDir, ".npmrc"),
              content: createNpmrcFileContent(),
            },
          ]
        : []),
    ],
    commands: [
      ...(request.noInstall ? [] : [{ type: "install" as const }]),
      { type: "ultracite-init" as const },
      { type: "intent-install" as const },
      ...(shouldRunInitialCodegen ? [{ type: "codegen" as const }] : []),
      ...(request.noInstall ? [] : [{ type: "fix" as const }]),
      ...(request.noInstall ? [] : [{ type: "lint" as const }]),
      ...(request.noGit ? [] : [{ type: "git-init" as const }]),
    ],
    tasks: {
      bootstrapFileMaker: request.dataSource === "filemaker" && !request.skipFileMakerSetup,
      checkWebViewerAddon: request.appType === "webviewer",
      runInstall: !request.noInstall,
      runUltraciteInit: true,
      runIntentInstall: true,
      runInitialCodegen: shouldRunInitialCodegen,
      runFix: !request.noInstall,
      runLint: !request.noInstall,
      initializeGit: !request.noGit,
    },
    nextSteps: [
      `cd ${request.appDir}`,
      ...(request.packageManager === "npm" ? [NPM_PACKAGE_MANAGER_WARNING] : []),
      ...(request.noInstall ? [request.packageManager === "yarn" ? "yarn" : `${request.packageManager} install`] : []),
      `${packageManagerExecuteCommand} @tanstack/intent@latest install`,
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
  if (mutations.devEngines) {
    packageJson.devEngines = mutations.devEngines;
    packageJson.packageManager = undefined;
  }
  packageJson.engines = mutations.engines as PackageJson["engines"];

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
