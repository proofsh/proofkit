import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Effect as Fx } from "effect";
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
import { ExternalCommandError, FileMakerSetupError, FileSystemError, UserCancelledError } from "~/core/errors.js";
import type { AppType, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
import { installFmAddonExplicitly } from "~/installers/install-fm-addon.js";
import { openBrowser } from "~/utils/browserOpen.js";
import { deleteJson, getJson, postJson } from "~/utils/http.js";
import { detectUserPackageManager } from "~/utils/packageManager.js";
import { createDataSourceEnvNames, updateEnvSchemaFile, updateTypegenConfig } from "~/utils/projectFiles.js";
import {
  confirmPrompt,
  spinner as createSpinner,
  isCancel,
  log,
  multiSearchSelectPrompt,
  note,
  passwordPrompt,
  searchSelectPrompt,
  selectPrompt,
  textPrompt,
} from "~/utils/prompts.js";

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new UserCancelledError({ message: "User aborted the operation" });
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
    if (layout.isFolder === true) {
      const folderLayouts = Array.isArray(layout.folderLayoutNames) ? layout.folderLayoutNames : [];
      return folderLayouts.flatMap((item) => flatten(item));
    }
    return typeof layout.name === "string" ? [layout.name] : [];
  };

  return layouts.flatMap(flatten).sort((left, right) => left.localeCompare(right));
}

function withFsError<A>(operation: string, targetPath: string, run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new FileSystemError({
        message: `File system ${operation} failed for ${targetPath}.`,
        operation,
        path: targetPath,
        cause,
      }),
  });
}

function withCommandError<A>(command: string, args: string[], cwd: string, run: () => Promise<A>, message?: string) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new ExternalCommandError({
        message: message ?? `Command failed: ${[command, ...args].join(" ")}`,
        command,
        args,
        cwd,
        cause,
      }),
  });
}

function withFileMakerSetupError<A>(message: string, run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new FileMakerSetupError({
        message,
        cause,
      }),
  });
}

const promptService = {
  text: async (options: { message: string; defaultValue?: string; validate?: (value: string) => string | undefined }) =>
    unwrap(
      await textPrompt({
        message: options.message,
        defaultValue: options.defaultValue,
        validate: options.validate,
      }),
    ).toString(),
  password: async (options: { message: string; validate?: (value: string) => string | undefined }) =>
    unwrap(
      await passwordPrompt({
        message: options.message,
        validate: options.validate,
      }),
    ).toString(),
  select: async <T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
  }) =>
    unwrap(
      await selectPrompt({
        message: options.message,
        options: options.options,
      }),
    ) as T,
  searchSelect: async <T extends string>(options: {
    message: string;
    emptyMessage?: string;
    options: Array<{ value: T; label: string; hint?: string; keywords?: string[]; disabled?: boolean | string }>;
  }) => unwrap(await searchSelectPrompt(options)) as T,
  multiSearchSelect: async <T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string; keywords?: string[]; disabled?: boolean | string }>;
    required?: boolean;
  }) => unwrap(await multiSearchSelectPrompt(options)),
  confirm: async (options: { message: string; initialValue?: boolean }) =>
    unwrap(
      await confirmPrompt({
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
  exists: (targetPath: string) => withFsError("exists", targetPath, () => fs.pathExists(targetPath)),
  readdir: (targetPath: string) => withFsError("readdir", targetPath, () => fs.readdir(targetPath)),
  emptyDir: (targetPath: string) => withFsError("emptyDir", targetPath, () => fs.emptyDir(targetPath)),
  copyDir: (from: string, to: string, options?: { overwrite?: boolean }) =>
    withFsError("copyDir", `${from} -> ${to}`, () => fs.copy(from, to, { overwrite: options?.overwrite ?? true })),
  rename: (from: string, to: string) => withFsError("rename", `${from} -> ${to}`, () => fs.rename(from, to)),
  remove: (targetPath: string) => withFsError("remove", targetPath, () => fs.remove(targetPath)),
  readJson: <T>(targetPath: string) => withFsError("readJson", targetPath, () => fs.readJson(targetPath) as Promise<T>),
  writeJson: (targetPath: string, value: unknown) =>
    withFsError("writeJson", targetPath, () => fs.writeJson(targetPath, value, { spaces: 2 })),
  writeFile: (targetPath: string, content: string) =>
    withFsError("writeFile", targetPath, () => fs.writeFile(targetPath, content, "utf8")),
  readFile: (targetPath: string) => withFsError("readFile", targetPath, () => fs.readFile(targetPath, "utf8")),
};

const templateService = {
  getTemplateDir: (appType: AppType, _ui: UIType) => {
    if (appType === "webviewer") {
      return path.join(TEMPLATE_ROOT, "vite-wv");
    }
    return path.join(TEMPLATE_ROOT, "nextjs-shadcn");
  },
};

const packageManagerService = {
  getVersion: (packageManager: string, cwd: string) => {
    if (packageManager === "bun") {
      return Effect.succeed(undefined);
    }
    return withCommandError(packageManager, ["-v"], cwd, async () => {
      const { stdout } = await execa(packageManager, ["-v"], { cwd });
      return stdout.trim();
    });
  },
};

const processService = {
  run: (
    command: string,
    args: string[],
    options: {
      cwd: string;
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
    },
  ) =>
    withCommandError(command, args, options.cwd, async () => {
      const result = await execa(command, args, {
        cwd: options.cwd,
        stdout: options.stdout ?? "pipe",
        stderr: options.stderr ?? "pipe",
      });
      return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    }),
};

const gitService = {
  initialize: (projectDir: string) =>
    Effect.gen(function* () {
      yield* withCommandError("git", ["init"], projectDir, () => execa("git", ["init"], { cwd: projectDir }));
      yield* withCommandError("git", ["add", "."], projectDir, () => execa("git", ["add", "."], { cwd: projectDir }));
      yield* withCommandError("git", ["commit", "-m", "Initial commit"], projectDir, () =>
        execa("git", ["commit", "-m", "Initial commit"], { cwd: projectDir }),
      );
    }),
};

const settingsService = {
  writeSettings: (projectDir: string, settings: ProofKitSettings) =>
    withFsError("writeSettings", path.join(projectDir, "proofkit.json"), () =>
      fs.writeJson(path.join(projectDir, "proofkit.json"), settings, { spaces: 2 }),
    ),
  appendEnvVars: (projectDir: string, vars: Record<string, string>) =>
    withFsError("appendEnvVars", path.join(projectDir, ".env"), async () => {
      const envPath = path.join(projectDir, ".env");
      const existing = (await fs.pathExists(envPath)) ? await fs.readFile(envPath, "utf8") : "";
      const additions = Object.entries(vars)
        .map(([name, value]) => `${name}=${value}`)
        .join("\n");
      const nextContent = [existing.trimEnd(), additions].filter(Boolean).join("\n").concat("\n");
      await fs.writeFile(envPath, nextContent, "utf8");
    }),
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

  if (inputs.mode === "local-fm-mcp") {
    return Promise.resolve({
      settings: nextSettings,
      envVars: {},
      envSchemaEntries: [],
      typegenConfig: {
        mode: inputs.mode,
        dataSourceName: inputs.dataSourceName,
        fmMcpBaseUrl: inputs.fmMcpBaseUrl,
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
  detectLocalFmMcp: (baseUrl = process.env.FM_MCP_BASE_URL ?? "http://127.0.0.1:1365") =>
    Effect.tryPromise({
      try: async () => {
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
      catch: (cause) =>
        new FileMakerSetupError({
          message: "Unable to detect local ProofKit MCP Server.",
          cause,
        }),
    }),
  installLocalWebViewerAddon: () =>
    Effect.tryPromise({
      try: async () => {
        await installFmAddonExplicitly({ addonName: "wv" });
      },
      catch: (cause) =>
        new FileMakerSetupError({
          message: "Unable to install local ProofKit WebViewer add-on files.",
          cause,
        }),
    }).pipe(Effect.asVoid),
  validateHostedServerUrl: (serverUrl: string, ottoPort?: number | null) =>
    Effect.gen(function* () {
      const normalizedUrl = normalizeUrl(serverUrl);
      const fmsUrl = new URL("/fmws/serverinfo", normalizedUrl).toString();
      const fmsResponse = yield* withFileMakerSetupError(
        `Unable to validate FileMaker Server URL: ${normalizedUrl}`,
        () => getJson<{ data?: { ServerVersion?: string } }>(fmsUrl),
      );
      const serverVersion = fmsResponse.data?.data?.ServerVersion?.split(" ")[0];
      if (!serverVersion) {
        return yield* Effect.fail(
          new FileMakerSetupError({
            message: `Invalid FileMaker Server URL: ${normalizedUrl}`,
          }),
        );
      }

      let ottoVersion: string | null = null;
      const otto4Response = yield* withFileMakerSetupError("Unable to query OttoFMS version.", () =>
        getJson<{ response?: { Otto?: { version?: string } } }>(new URL("/otto/api/info", normalizedUrl).toString()),
      ).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
      ottoVersion = otto4Response?.data?.response?.Otto?.version ?? null;

      if (!ottoVersion) {
        const otto3Url = new URL(normalizedUrl);
        otto3Url.port = ottoPort ? String(ottoPort) : "3030";
        otto3Url.pathname = "/api/otto/info";
        const otto3Response = yield* withFileMakerSetupError("Unable to query OttoFMS v3 version.", () =>
          getJson<{ Otto?: { version?: string } }>(otto3Url.toString()),
        ).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
        ottoVersion = otto3Response?.data?.Otto?.version ?? null;
      }

      return {
        normalizedUrl: new URL(normalizedUrl).origin,
        versions: {
          fmsVersion: serverVersion,
          ottoVersion,
        },
      };
    }),
  getOttoFMSToken: ({ url }: { url: URL }) =>
    Effect.gen(function* () {
      const hash = randomUUID().replaceAll("-", "").slice(0, 18);
      const loginUrl = new URL(`/otto/wizard/${hash}`, url.origin);
      log.info(`If the browser window didn't open automatically, use this Otto login URL:\n${loginUrl.toString()}`);
      yield* withFileMakerSetupError("Unable to open OttoFMS login URL.", () => openBrowser(loginUrl.toString()));

      const spin = createSpinner();
      spin.start("Waiting for OttoFMS login");

      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        const response = yield* withFileMakerSetupError("Unable to poll OttoFMS login status.", () =>
          getJson<{ response?: { token?: string } }>(`${url.origin}/otto/api/cli/checkHash/${hash}`, {
            headers: { "Accept-Encoding": "deflate" },
            timeout: 5000,
          }),
        ).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
        const token = response?.data?.response?.token;
        if (token) {
          spin.stop("Login complete");
          yield* withFileMakerSetupError("Unable to clean up OttoFMS login state.", () =>
            deleteJson(`${url.origin}/otto/api/cli/checkHash/${hash}`, {
              headers: { "Accept-Encoding": "deflate" },
            }),
          ).pipe(Effect.catchAll(() => Effect.void));
          return { token };
        }
        yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 500)));
      }

      spin.stop("Login timed out");
      return yield* Effect.fail(
        new FileMakerSetupError({
          message: "OttoFMS login timed out after 3 minutes.",
        }),
      );
    }),
  listFiles: ({ url, token }: { url: URL; token: string }) =>
    Effect.gen(function* () {
      const response = yield* withFileMakerSetupError("Unable to list FileMaker files from OttoFMS.", () =>
        getJson<{ response?: { databases?: Array<{ filename?: string; status?: string }> } }>(
          `${url.origin}/otto/fmi/admin/api/v2/databases`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );
      const databases = Array.isArray(response.data?.response?.databases) ? response.data.response.databases : [];
      return databases
        .filter((database): database is { filename: string; status?: string } => typeof database.filename === "string")
        .map(
          (database) =>
            ({
              filename: database.filename,
              status: database.status ?? "unknown",
            }) satisfies OttoFileInfo,
        );
    }),
  listAPIKeys: ({ url, token }: { url: URL; token: string }) =>
    Effect.gen(function* () {
      const response = yield* withFileMakerSetupError("Unable to list OttoFMS Data API keys.", () =>
        getJson<{ response?: { "api-keys"?: Record<string, unknown>[] } }>(`${url.origin}/otto/api/api-key`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );
      const apiKeys = Array.isArray(response.data?.response?.["api-keys"]) ? response.data.response["api-keys"] : [];
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
    }),
  createDataAPIKeyWithCredentials: ({
    url,
    filename,
    username,
    password: userPassword,
  }: {
    url: URL;
    filename: string;
    username: string;
    password: string;
  }) =>
    Effect.gen(function* () {
      const response = yield* withFileMakerSetupError(`Unable to create a Data API key for ${filename}.`, () =>
        postJson<{ response?: { key?: string } }>(`${url.origin}/otto/api/api-key/create-only`, {
          database: filename,
          label: "For FM Web App",
          user: username,
          pass: userPassword,
        }),
      );
      const apiKey = response.data?.response?.key;
      if (!apiKey) {
        return yield* Effect.fail(
          new FileMakerSetupError({
            message: `Failed to create a Data API key for ${filename}.`,
          }),
        );
      }
      return { apiKey };
    }),
  startDeployment: ({ payload, url, token }: { payload: unknown; url: URL; token: string }) =>
    withFileMakerSetupError("Unable to start ProofKit Demo deployment.", () =>
      postJson<{ response?: { subDeploymentIds?: number[] } }>(`${url.origin}/otto/api/deployment`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    ),
  getDeploymentStatus: ({ url, token, deploymentId }: { url: URL; token: string; deploymentId: number }) =>
    withFileMakerSetupError(`Unable to fetch deployment status for ${deploymentId}.`, () =>
      getJson<{ response?: { status?: string; running?: boolean } }>(
        `${url.origin}/otto/api/deployment/${deploymentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      ),
    ),
  deployDemoFile: ({ url, token, operation }: { url: URL; token: string; operation: "install" | "replace" }) =>
    Effect.gen(function* () {
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
              url: "https://proofkit.proof.sh/proofkit-demo/manifest.json",
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

      const deployment = yield* fileMakerService.startDeployment({
        payload: deploymentPayload,
        url,
        token,
      });

      const deploymentId = deployment.data?.response?.subDeploymentIds?.[0];
      if (!deploymentId) {
        spin.stop("Demo deployment failed");
        return yield* Effect.fail(
          new FileMakerSetupError({
            message: "No deployment ID was returned when deploying the demo file.",
          }),
        );
      }

      const deploymentDeadline = Date.now() + 300_000;
      let deploymentCompleted = false;
      while (Date.now() < deploymentDeadline) {
        yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 2500)));
        const status = yield* fileMakerService.getDeploymentStatus({
          url,
          token,
          deploymentId,
        });

        if (!status.data?.response?.running) {
          if (status.data?.response?.status !== "complete") {
            spin.stop("Demo deployment failed");
            return yield* Effect.fail(
              new FileMakerSetupError({
                message: "ProofKit Demo deployment did not complete successfully.",
              }),
            );
          }
          deploymentCompleted = true;
          break;
        }
      }

      if (!deploymentCompleted) {
        spin.stop("Demo deployment timed out");
        return yield* Effect.fail(
          new FileMakerSetupError({
            message: "ProofKit Demo deployment timed out after 5 minutes.",
          }),
        );
      }

      const apiKey = yield* fileMakerService.createDataAPIKeyWithCredentials({
        url,
        filename: demoFileName,
        username: "admin",
        password: "admin",
      });
      spin.stop("Demo file deployed");
      return { apiKey: apiKey.apiKey, filename: demoFileName };
    }),
  listLayouts: ({ dataApiKey, fmFile, server }: { dataApiKey: string; fmFile: string; server: string }) =>
    Effect.gen(function* () {
      const response = yield* withFileMakerSetupError(`Unable to list layouts for ${fmFile}.`, () =>
        getJson<{ response?: { layouts?: LayoutFolder[] } }>(
          `${server}/otto/fmi/data/vLatest/databases/${encodeURIComponent(fmFile)}/layouts`,
          {
            headers: {
              Authorization: `Bearer ${dataApiKey}`,
            },
          },
        ),
      );
      const layouts = Array.isArray(response.data?.response?.layouts) ? response.data.response.layouts : [];
      return transformLayoutList(layouts);
    }),
  createFileMakerBootstrapArtifacts: (settings: ProofKitSettings, inputs: FileMakerInputs, appType: AppType) =>
    withFileMakerSetupError("Unable to prepare FileMaker bootstrap artifacts.", () =>
      createFileMakerBootstrapArtifacts(settings, inputs, appType),
    ),
  bootstrap: (projectDir: string, settings: ProofKitSettings, inputs: FileMakerInputs, appType: AppType) =>
    Effect.gen(function* () {
      const artifacts = yield* fileMakerService.createFileMakerBootstrapArtifacts(settings, inputs, appType);
      const projectFilesFs = {
        exists: (targetPath: string) => Effect.runPromise(fileSystemService.exists(targetPath)),
        readFile: (targetPath: string) => Effect.runPromise(fileSystemService.readFile(targetPath)),
        writeFile: (targetPath: string, content: string) =>
          Effect.runPromise(fileSystemService.writeFile(targetPath, content)),
      };
      if (Object.keys(artifacts.envVars).length > 0) {
        yield* settingsService.appendEnvVars(projectDir, artifacts.envVars);
        yield* withFileMakerSetupError("Unable to update env schema for FileMaker bootstrap.", () =>
          updateEnvSchemaFile(projectFilesFs, projectDir, artifacts.envSchemaEntries),
        );
      }

      yield* withFileMakerSetupError("Unable to update typegen config for FileMaker bootstrap.", () =>
        updateTypegenConfig(projectFilesFs, projectDir, {
          appType: artifacts.typegenConfig.appType,
          dataSourceName: artifacts.typegenConfig.dataSourceName,
          envNames: artifacts.typegenConfig.envNames,
          fmMcpBaseUrl: artifacts.typegenConfig.fmMcpBaseUrl,
          connectedFileName: artifacts.typegenConfig.connectedFileName,
          layoutName: artifacts.typegenConfig.layoutName,
          schemaName: artifacts.typegenConfig.schemaName,
        }),
      );

      return artifacts.settings;
    }),
};

const codegenService = {
  runInitial: (projectDir: string, packageManager: CliContextValue["packageManager"]) => {
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
      return Effect.fail(
        new ExternalCommandError({
          message: "Unable to resolve the codegen command",
          command: packageManager,
          args: commandParts.slice(1),
          cwd: projectDir,
        }),
      );
    }
    const args = commandParts.slice(1);
    return withCommandError(
      command,
      args,
      projectDir,
      async () => {
        await execa(command, args, { cwd: projectDir });
      },
      "Initial codegen failed",
    );
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

  return <A, E, R>(effect: Fx.Effect<A, E, R>) => Effect.provide(effect, layer);
}
