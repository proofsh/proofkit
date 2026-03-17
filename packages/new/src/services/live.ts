import { randomUUID } from "node:crypto";
import path from "node:path";
import { confirm, spinner as createSpinner, isCancel, log, note, password, select, text } from "@clack/prompts";
import { Effect, Layer } from "effect";
import { execa } from "execa";
import fs from "fs-extra";
import { TEMPLATE_ROOT } from "~/consts.js";
import {
  CliContext,
  type CliContextValue,
  CodegenService,
  ConsoleService,
  type FileMakerBootstrapArtifacts,
  FileMakerService,
  FileSystemService,
  GitService,
  type OttoApiKeyInfo,
  type OttoFileInfo,
  PackageManagerService,
  ProcessService,
  PromptService,
  SettingsService,
  TemplateService,
} from "~/core/context.js";
import { UserAbortedError } from "~/core/errors.js";
import type { AppType, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
import { openBrowser } from "~/utils/browserOpen.js";
import { deleteJson, getJson, postJson } from "~/utils/http.js";
import { detectUserPackageManager } from "~/utils/packageManager.js";
import { createDataSourceEnvNames, updateEnvSchemaFile, updateTypegenConfig } from "~/utils/projectFiles.js";
import { promptSearchSelect } from "~/utils/promptSearch.js";

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new UserAbortedError();
  }
  return value as T;
}

function normalizeUrl(serverUrl: string) {
  if (serverUrl.startsWith("https://")) {
    return serverUrl;
  }
  if (serverUrl.startsWith("http://")) {
    return serverUrl.replace("http://", "https://");
  }
  return `https://${serverUrl}`;
}

interface LayoutFolder {
  isFolder?: boolean;
  name?: string;
  folderLayoutNames?: LayoutFolder[];
}

function transformLayoutList(layouts: LayoutFolder[]): string[] {
  const flatten = (layout: LayoutFolder): string[] => {
    if ("isFolder" in layout) {
      const folderLayouts = Array.isArray(layout.folderLayoutNames) ? layout.folderLayoutNames : [];
      return folderLayouts.flatMap((item) => flatten(item));
    }
    return typeof layout.name === "string" ? [layout.name] : [];
  };

  return layouts.flatMap(flatten).sort((left, right) => left.localeCompare(right));
}

const promptService = {
  text: async (options: { message: string; defaultValue?: string; validate?: (value: string) => string | undefined }) =>
    unwrap(
      await text({
        message: options.message,
        defaultValue: options.defaultValue,
        validate: options.validate,
      }),
    ).toString(),
  password: async (options: { message: string; validate?: (value: string) => string | undefined }) =>
    unwrap(
      await password({
        message: options.message,
        validate: options.validate,
      }),
    ).toString(),
  select: async <T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
  }) =>
    unwrap(
      await select({
        message: options.message,
        options: options.options as never,
      }),
    ) as T,
  searchSelect: async <T extends string>(options: {
    message: string;
    searchLabel?: string;
    emptyMessage?: string;
    options: Array<{ value: T; label: string; hint?: string; keywords?: string[] }>;
  }) =>
    promptSearchSelect(
      {
        promptForSearch: async (message) =>
          unwrap(
            await text({
              message,
              placeholder: "Type to filter results",
            }),
          ).toString(),
        promptForSelect: async (message, items) =>
          unwrap(
            await select({
              message,
              options: items as never,
            }),
          ) as T | "__search__",
      },
      options,
    ),
  confirm: async (options: { message: string; initialValue?: boolean }) =>
    unwrap(
      await confirm({
        message: options.message,
        initialValue: options.initialValue,
      }),
    ) as boolean,
};

const consoleService = {
  info: (message: string) => log.info(message),
  warn: (message: string) => log.warn(message),
  error: (message: string) => log.error(message),
  success: (message: string) => log.success(message),
  note: (message: string, title?: string) => note(message, title),
};

const fileSystemService = {
  exists: async (targetPath: string) => fs.pathExists(targetPath),
  readdir: async (targetPath: string) => fs.readdir(targetPath),
  emptyDir: async (targetPath: string) => fs.emptyDir(targetPath),
  copyDir: async (from: string, to: string, options?: { overwrite?: boolean }) =>
    fs.copy(from, to, { overwrite: options?.overwrite ?? true }),
  rename: async (from: string, to: string) => fs.rename(from, to),
  remove: async (targetPath: string) => fs.remove(targetPath),
  readJson: async <T>(targetPath: string) => fs.readJson(targetPath) as Promise<T>,
  writeJson: async (targetPath: string, value: unknown) => fs.writeJson(targetPath, value, { spaces: 2 }),
  writeFile: async (targetPath: string, content: string) => fs.writeFile(targetPath, content, "utf8"),
  readFile: async (targetPath: string) => fs.readFile(targetPath, "utf8"),
};

const templateService = {
  getTemplateDir: (appType: AppType, ui: UIType) => {
    if (appType === "webviewer") {
      return path.join(TEMPLATE_ROOT, "vite-wv");
    }
    if (ui === "mantine") {
      return path.join(TEMPLATE_ROOT, "nextjs-mantine");
    }
    return path.join(TEMPLATE_ROOT, "nextjs-shadcn");
  },
};

const packageManagerService = {
  getVersion: async (packageManager: string, cwd: string) => {
    if (packageManager === "bun") {
      return undefined;
    }
    const { stdout } = await execa(packageManager, ["-v"], { cwd });
    return stdout.trim();
  },
};

const processService = {
  run: async (
    command: string,
    args: string[],
    options: {
      cwd: string;
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
    },
  ) => {
    const result = await execa(command, args, {
      cwd: options.cwd,
      stdout: options.stdout ?? "pipe",
      stderr: options.stderr ?? "pipe",
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  },
};

const gitService = {
  initialize: async (projectDir: string) => {
    await execa("git", ["init"], { cwd: projectDir });
    await execa("git", ["add", "."], { cwd: projectDir });
    await execa("git", ["commit", "-m", "Initial commit"], { cwd: projectDir });
  },
};

const settingsService = {
  writeSettings: async (projectDir: string, settings: ProofKitSettings) =>
    fs.writeJson(path.join(projectDir, "proofkit.json"), settings, { spaces: 2 }),
  appendEnvVars: async (projectDir: string, vars: Record<string, string>) => {
    const envPath = path.join(projectDir, ".env");
    const existing = (await fs.pathExists(envPath)) ? await fs.readFile(envPath, "utf8") : "";
    const additions = Object.entries(vars)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n");
    const nextContent = [existing.trimEnd(), additions].filter(Boolean).join("\n").concat("\n");
    await fs.writeFile(envPath, nextContent, "utf8");
  },
  ensureTypegenConfig: async (_projectDir: string, _options: { appType: AppType; fileMaker?: FileMakerInputs }) =>
    undefined,
};

function createDataSourceEntry(dataSourceName: string) {
  return {
    type: "fm" as const,
    name: dataSourceName,
    envNames: createDataSourceEnvNames(dataSourceName),
  };
}

function createFileMakerBootstrapArtifacts(
  settings: ProofKitSettings,
  inputs: FileMakerInputs,
  appType: AppType,
): Promise<FileMakerBootstrapArtifacts> {
  const dataSourceEntry = createDataSourceEntry(inputs.dataSourceName);
  const nextSettings: ProofKitSettings = {
    ...settings,
    dataSources: settings.dataSources.some((entry) => entry.name === dataSourceEntry.name)
      ? settings.dataSources
      : [...settings.dataSources, dataSourceEntry],
  };

  if (inputs.mode === "local-fm-http") {
    return Promise.resolve({
      settings: nextSettings,
      envVars: {},
      envSchemaEntries: [],
      typegenConfig: {
        mode: inputs.mode,
        dataSourceName: inputs.dataSourceName,
        fmHttpBaseUrl: inputs.fmHttpBaseUrl,
        connectedFileName: inputs.fileName,
        layoutName: inputs.layoutName,
        schemaName: inputs.schemaName,
        appType,
      },
    });
  }

  return Promise.resolve({
    settings: nextSettings,
    envVars: {
      [inputs.envNames.database]: inputs.fileName,
      [inputs.envNames.server]: inputs.server,
      [inputs.envNames.apiKey]: inputs.dataApiKey,
    },
    envSchemaEntries: [
      {
        name: inputs.envNames.database,
        zodSchema: 'z.string().endsWith(".fmp12")',
        defaultValue: inputs.fileName,
      },
      {
        name: inputs.envNames.server,
        zodSchema: "z.string().url()",
        defaultValue: inputs.server,
      },
      {
        name: inputs.envNames.apiKey,
        zodSchema: 'z.string().startsWith("dk_")',
        defaultValue: inputs.dataApiKey,
      },
    ],
    typegenConfig: {
      mode: inputs.mode,
      dataSourceName: inputs.dataSourceName,
      envNames: inputs.envNames,
      layoutName: inputs.layoutName,
      schemaName: inputs.schemaName,
      appType,
    },
  });
}

const fileMakerService = {
  detectLocalFmHttp: async (baseUrl = process.env.FM_HTTP_BASE_URL ?? "http://127.0.0.1:1365") => {
    try {
      const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (!health.ok) {
        return { baseUrl, healthy: false, connectedFiles: [] };
      }
      const connectedFiles = await fetch(`${baseUrl}/connectedFiles`, { signal: AbortSignal.timeout(3000) })
        .then(async (response) => (response.ok ? ((await response.json()) as unknown) : []))
        .catch(() => []);
      return {
        baseUrl,
        healthy: true,
        connectedFiles: Array.isArray(connectedFiles)
          ? connectedFiles.filter((item): item is string => typeof item === "string")
          : [],
      };
    } catch {
      return { baseUrl, healthy: false, connectedFiles: [] };
    }
  },
  validateHostedServerUrl: async (serverUrl: string, ottoPort?: number | null) => {
    const normalizedUrl = normalizeUrl(serverUrl);
    const fmsUrl = new URL("/fmws/serverinfo", normalizedUrl).toString();
    const fmsResponse = await getJson<{ data?: { ServerVersion?: string } }>(fmsUrl);
    const serverVersion = fmsResponse.data?.data?.ServerVersion?.split(" ")[0];
    if (!serverVersion) {
      throw new Error(`Invalid FileMaker Server URL: ${normalizedUrl}`);
    }

    let ottoVersion: string | null = null;
    const otto4Response = await getJson<{ response?: { Otto?: { version?: string } } }>(
      new URL("/otto/api/info", normalizedUrl).toString(),
    );
    ottoVersion = otto4Response.data?.response?.Otto?.version ?? null;

    if (!ottoVersion) {
      const otto3Url = new URL(normalizedUrl);
      otto3Url.port = ottoPort ? String(ottoPort) : "3030";
      otto3Url.pathname = "/api/otto/info";
      const otto3Response = await getJson<{ Otto?: { version?: string } }>(otto3Url.toString());
      ottoVersion = otto3Response.data?.Otto?.version ?? null;
    }

    return {
      normalizedUrl: new URL(normalizedUrl).origin,
      versions: {
        fmsVersion: serverVersion,
        ottoVersion,
      },
    };
  },
  getOttoFMSToken: async ({ url }: { url: URL }) => {
    const hash = randomUUID().replaceAll("-", "").slice(0, 18);
    const loginUrl = new URL(`/otto/wizard/${hash}`, url.origin);
    log.info(`If the browser window didn't open automatically, use this Otto login URL:\n${loginUrl.toString()}`);
    await openBrowser(loginUrl.toString());

    const spin = createSpinner();
    spin.start("Waiting for OttoFMS login");

    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const response = await getJson<{ response?: { token?: string } }>(
        `${url.origin}/otto/api/cli/checkHash/${hash}`,
        { headers: { "Accept-Encoding": "deflate" }, timeout: 5000 },
      ).catch(() => undefined);
      const token = response?.data?.response?.token;
      if (token) {
        spin.stop("Login complete");
        await deleteJson(`${url.origin}/otto/api/cli/checkHash/${hash}`, {
          headers: { "Accept-Encoding": "deflate" },
        }).catch(() => undefined);
        return { token };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    spin.stop("Login timed out");
    throw new Error("OttoFMS login timed out after 3 minutes.");
  },
  listFiles: async ({ url, token }: { url: URL; token: string }) => {
    const response = await getJson<{ response?: { databases?: Array<{ filename?: string; status?: string }> } }>(
      `${url.origin}/otto/fmi/admin/api/v2/databases`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const databases = (response.data?.response?.databases ?? []) as Record<string, unknown>[];
    return databases
      .filter((database): database is { filename: string; status?: string } => typeof database.filename === "string")
      .map(
        (database) =>
          ({
            filename: database.filename,
            status: database.status ?? "unknown",
          }) satisfies OttoFileInfo,
      );
  },
  listAPIKeys: async ({ url, token }: { url: URL; token: string }) => {
    const response = await getJson<{ response?: { "api-keys"?: Record<string, unknown>[] } }>(
      `${url.origin}/otto/api/api-key`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const apiKeys = (response.data?.response?.["api-keys"] ?? []) as Record<string, unknown>[];
    return apiKeys
      .filter(
        (apiKey): apiKey is { key: string; user: string; database: string; label: string } =>
          typeof apiKey.key === "string" &&
          typeof apiKey.user === "string" &&
          typeof apiKey.database === "string" &&
          typeof apiKey.label === "string",
      )
      .map(
        (apiKey) =>
          ({
            key: apiKey.key,
            user: apiKey.user,
            database: apiKey.database,
            label: apiKey.label,
          }) satisfies OttoApiKeyInfo,
      );
  },
  createDataAPIKeyWithCredentials: async ({
    url,
    filename,
    username,
    password: userPassword,
  }: {
    url: URL;
    filename: string;
    username: string;
    password: string;
  }) => {
    const response = await postJson<{ response?: { key?: string } }>(`${url.origin}/otto/api/api-key/create-only`, {
      database: filename,
      label: "For FM Web App",
      user: username,
      pass: userPassword,
    });
    const apiKey = response.data?.response?.key;
    if (!apiKey) {
      throw new Error(`Failed to create a Data API key for ${filename}.`);
    }
    return { apiKey };
  },
  startDeployment: async ({ payload, url, token }: { payload: unknown; url: URL; token: string }) =>
    postJson<{ response?: { subDeploymentIds?: number[] } }>(`${url.origin}/otto/api/deployment`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  getDeploymentStatus: async ({ url, token, deploymentId }: { url: URL; token: string; deploymentId: number }) =>
    getJson<{ response?: { status?: string; running?: boolean } }>(
      `${url.origin}/otto/api/deployment/${deploymentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    ),
  deployDemoFile: async ({ url, token, operation }: { url: URL; token: string; operation: "install" | "replace" }) => {
    const demoFileName = "ProofKitDemo.fmp12";
    const spin = createSpinner();
    spin.start("Deploying ProofKit Demo file");

    const deploymentPayload = {
      scheduled: false,
      label: "Install ProofKit Demo",
      deployments: [
        {
          name: "Install ProofKit Demo",
          source: {
            type: "url",
            url: "https://proofkit.dev/proofkit-demo/manifest.json",
          },
          fileOperations: [
            {
              target: {
                fileName: demoFileName,
              },
              operation,
              source: {
                fileName: demoFileName,
              },
              location: {
                folder: "default",
                subFolder: "",
              },
            },
          ],
          concurrency: 1,
          options: {
            closeFilesAfterBuild: false,
            keepFilesClosedAfterComplete: false,
            transferContainerData: false,
          },
        },
      ],
      abortRemaining: false,
    };

    const deployment = await fileMakerService.startDeployment({
      payload: deploymentPayload,
      url,
      token,
    });

    const deploymentId = deployment.data?.response?.subDeploymentIds?.[0];
    if (!deploymentId) {
      spin.stop("Demo deployment failed");
      throw new Error("No deployment ID was returned when deploying the demo file.");
    }

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const status = await fileMakerService.getDeploymentStatus({
        url,
        token,
        deploymentId,
      });

      if (!status.data?.response?.running) {
        if (status.data?.response?.status !== "complete") {
          spin.stop("Demo deployment failed");
          throw new Error("ProofKit Demo deployment did not complete successfully.");
        }
        break;
      }
    }

    const apiKey = await fileMakerService.createDataAPIKeyWithCredentials({
      url,
      filename: demoFileName,
      username: "admin",
      password: "admin",
    });
    spin.stop("Demo file deployed");
    return { apiKey: apiKey.apiKey, filename: demoFileName };
  },
  listLayouts: async ({ dataApiKey, fmFile, server }: { dataApiKey: string; fmFile: string; server: string }) => {
    const response = await getJson<{ response?: { layouts?: LayoutFolder[] } }>(
      `${server}/otto/fmi/data/vLatest/databases/${encodeURIComponent(fmFile)}/layouts`,
      {
        headers: {
          Authorization: `Bearer ${dataApiKey}`,
        },
      },
    );
    return transformLayoutList(response.data?.response?.layouts ?? []);
  },
  createFileMakerBootstrapArtifacts,
  bootstrap: async (projectDir: string, settings: ProofKitSettings, inputs: FileMakerInputs, appType: AppType) => {
    const artifacts = await createFileMakerBootstrapArtifacts(settings, inputs, appType);
    if (Object.keys(artifacts.envVars).length > 0) {
      await settingsService.appendEnvVars(projectDir, artifacts.envVars);
      await updateEnvSchemaFile(fileSystemService, projectDir, artifacts.envSchemaEntries);
    }

    await updateTypegenConfig(fileSystemService, projectDir, {
      appType: artifacts.typegenConfig.appType,
      dataSourceName: artifacts.typegenConfig.dataSourceName,
      envNames: artifacts.typegenConfig.envNames,
      fmHttpBaseUrl: artifacts.typegenConfig.fmHttpBaseUrl,
      connectedFileName: artifacts.typegenConfig.connectedFileName,
      layoutName: artifacts.typegenConfig.layoutName,
      schemaName: artifacts.typegenConfig.schemaName,
    });

    return artifacts.settings;
  },
};

const codegenService = {
  runInitial: async (projectDir: string, packageManager: CliContextValue["packageManager"]) => {
    let commandParts: string[];
    if (packageManager === "npm") {
      commandParts = ["npm", "run", "typegen"];
    } else if (packageManager === "bun") {
      commandParts = ["bun", "run", "typegen"];
    } else {
      commandParts = [packageManager, "typegen"];
    }
    const command = commandParts[0];
    if (!command) {
      throw new Error("Unable to resolve the codegen command");
    }
    const args = commandParts.slice(1);
    await execa(command, args, { cwd: projectDir });
  },
};

export function makeLiveLayer(options: { cwd: string; debug: boolean; nonInteractive: boolean }) {
  const cliContext: CliContextValue = {
    cwd: options.cwd,
    debug: options.debug,
    nonInteractive: options.nonInteractive,
    packageManager: detectUserPackageManager(),
  };

  const layer = Layer.mergeAll(
    Layer.succeed(CliContext, cliContext),
    Layer.succeed(PromptService, promptService),
    Layer.succeed(ConsoleService, consoleService),
    Layer.succeed(FileSystemService, fileSystemService),
    Layer.succeed(TemplateService, templateService),
    Layer.succeed(PackageManagerService, packageManagerService),
    Layer.succeed(ProcessService, processService),
    Layer.succeed(GitService, gitService),
    Layer.succeed(SettingsService, settingsService),
    Layer.succeed(FileMakerService, fileMakerService),
    Layer.succeed(CodegenService, codegenService),
  );

  return <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, layer);
}
