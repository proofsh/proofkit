import path from "node:path";
import type { PackageJson } from "type-fest";

import type { InitPlan, InitRequest, ProofKitSettings } from "~/core/types.js";
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

function createTypegenConfig(request: InitRequest) {
  const layouts =
    request.fileMaker?.layoutName && request.fileMaker?.schemaName
      ? [
          {
            layoutName: request.fileMaker.layoutName,
            schemaName: request.fileMaker.schemaName,
            valueLists: "allowEmpty",
          },
        ]
      : [];

  return JSON.stringify(
    {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: [
        {
          type: "fmdapi",
          layouts,
          path: "./src/config/schemas/filemaker",
          clearOldFiles: true,
          clientSuffix: "Layout",
          ...(request.appType === "webviewer" ? { webviewerScriptName: "ExecuteDataApi" } : {}),
        },
      ],
    },
    null,
    2,
  ).concat("\n");
}

export function planInit(
  request: InitRequest,
  options: { templateDir: string; packageManagerVersion?: string },
): InitPlan {
  const targetDir = path.resolve(request.cwd, request.appDir);
  const releaseTag = getProofkitReleaseTag();
  const settings = createDefaultSettings(request);

  const packageJson: InitPlan["packageJson"] = {
    name: request.scopedAppName,
    packageManager: options.packageManagerVersion
      ? `${request.packageManager}@${options.packageManagerVersion}`
      : undefined,
    proofkitMetadata: {
      initVersion: "0.0.0-private",
      scaffoldPackage: "@proofkit/new",
    },
    dependencies: {},
    devDependencies: {
      "@types/node": `^${getNodeMajorVersion()}`,
    },
  };

  if (request.appType === "browser") {
    packageJson.dependencies["@radix-ui/react-slot"] = "^1.2.3";
    packageJson.dependencies["@tailwindcss/postcss"] = "^4.1.10";
    packageJson.dependencies["class-variance-authority"] = "^0.7.1";
    packageJson.dependencies.clsx = "^2.1.1";
    packageJson.dependencies["lucide-react"] = "^0.577.0";
    packageJson.dependencies["next-themes"] = "^0.4.6";
    packageJson.dependencies["tailwind-merge"] = "^3.5.0";
    packageJson.dependencies.tailwindcss = "^4.1.10";
    packageJson.dependencies["tw-animate-css"] = "^1.4.0";
  }

  if (request.appType === "webviewer") {
    packageJson.dependencies["@proofkit/fmdapi"] = releaseTag;
    packageJson.dependencies["@proofkit/webviewer"] = releaseTag;
    packageJson.dependencies["@radix-ui/react-slot"] = "^1.2.3";
    packageJson.dependencies["class-variance-authority"] = "^0.7.1";
    packageJson.dependencies.clsx = "^2.1.1";
    packageJson.dependencies["lucide-react"] = "^0.577.0";
    packageJson.dependencies["tailwind-merge"] = "^3.5.0";
    packageJson.dependencies.tailwindcss = "^4.1.10";
    packageJson.dependencies["tw-animate-css"] = "^1.4.0";
    packageJson.dependencies.zod = "^4";
    packageJson.devDependencies["@proofkit/typegen"] = releaseTag;
    packageJson.devDependencies["@tailwindcss/vite"] = "^4.2.1";
  }

  const writes: InitPlan["writes"] = [];
  if (request.dataSource === "filemaker") {
    writes.push({
      path: path.join(targetDir, "proofkit-typegen.config.jsonc"),
      content: createTypegenConfig(request),
    });
  }

  return {
    request,
    targetDir,
    templateDir: options.templateDir,
    packageJson,
    settings,
    envFile: {
      path: path.join(targetDir, ".env"),
      content: createEnvFileContent(),
    },
    writes,
    commands: [
      ...(request.noInstall ? [] : [{ type: "install" as const }]),
      ...(request.dataSource === "filemaker" &&
      !(request.appType === "webviewer" && request.nonInteractive && !request.hasExplicitFileMakerInputs)
        ? [{ type: "codegen" as const }]
        : []),
      ...(request.noGit ? [] : [{ type: "git-init" as const }]),
    ],
    tasks: {
      bootstrapFileMaker: request.dataSource === "filemaker",
      runInstall: !request.noInstall,
      runInitialCodegen:
        request.dataSource === "filemaker" &&
        !(request.appType === "webviewer" && request.nonInteractive && !request.hasExplicitFileMakerInputs),
      initializeGit: !request.noGit,
    },
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
