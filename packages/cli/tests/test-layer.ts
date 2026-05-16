import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Effect as Fx } from "effect";
import { Effect, Layer } from "effect";
import fs from "fs-extra";
import {
  CliContext,
  CodegenService,
  ConsoleService,
  FileMakerService,
  FileSystemService,
  GitService,
  PackageManagerService,
  ProcessService,
  PromptService,
  SettingsService,
  TemplateService,
} from "~/core/context.js";
import { type ExternalCommandError, FileMakerSetupError, FileSystemError, UserCancelledError } from "~/core/errors.js";
import type { AppType, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
import type { PackageManager } from "~/utils/packageManager.js";
import { createDataSourceEnvNames, updateTypegenConfig } from "~/utils/projectFiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PromptScript {
  text?: string[];
  select?: string[];
  confirm?: boolean[];
  password?: string[];
  searchSelect?: string[];
  multiSearchSelect?: string[][];
}

export interface ConsoleTranscript {
  info: string[];
  warn: string[];
  error: string[];
  success: string[];
  note: Array<{ message: string; title?: string }>;
}

export interface PromptTranscript {
  text: string[];
  password: string[];
  select: Array<{
    message: string;
    options: string[];
  }>;
  searchSelect: string[];
  multiSearchSelect: string[];
  confirm: string[];
}

export function makeTestLayer(options: {
  cwd: string;
  packageManager: PackageManager;
  nonInteractive?: boolean;
  prompts?: PromptScript;
  console?: ConsoleTranscript;
  failProcessCommand?: string;
  promptTranscript?: PromptTranscript;
  tracker?: {
    commands: string[];
    gitInits: number;
    codegens: number;
    filemakerBootstraps: number;
    addonInstalls?: number;
    localFmMcpAuthorizations?: { clientName: string; clientDescription: string }[];
  };
  fileMaker?: {
    localFmMcp?:
      | {
          healthy: boolean;
          baseUrl?: string;
          connectedFiles?: string[];
        }
      | Array<{
          healthy: boolean;
          baseUrl?: string;
          connectedFiles?: string[];
        }>;
  };
  failures?: {
    processRun?: unknown;
    gitInitialize?: unknown;
    codegenRun?: unknown;
    validateHostedServerUrl?: unknown;
    deployDemoFile?: unknown;
    packageManagerGetVersion?: Partial<Record<PackageManager, unknown>>;
  };
}) {
  const tracker = options.tracker;
  const promptScript = {
    text: [...(options.prompts?.text ?? [])],
    select: [...(options.prompts?.select ?? [])],
    confirm: [...(options.prompts?.confirm ?? [])],
    password: [...(options.prompts?.password ?? [])],
    searchSelect: [...(options.prompts?.searchSelect ?? [])],
    multiSearchSelect: [...(options.prompts?.multiSearchSelect ?? [])],
  };
  const consoleTranscript = options.console;
  let localFmMcpScript:
    | Array<{
        healthy: boolean;
        baseUrl?: string;
        connectedFiles?: string[];
      }>
    | undefined;
  if (Array.isArray(options.fileMaker?.localFmMcp)) {
    localFmMcpScript = [...options.fileMaker.localFmMcp];
  } else if (options.fileMaker?.localFmMcp) {
    localFmMcpScript = [options.fileMaker.localFmMcp];
  } else {
    localFmMcpScript = [];
  }
  let lastLocalFmMcp = localFmMcpScript[0];

  const layer = Layer.mergeAll(
    Layer.succeed(CliContext, {
      cwd: options.cwd,
      debug: false,
      nonInteractive: options.nonInteractive ?? true,
      packageManager: options.packageManager,
    }),
    Layer.succeed(PromptService, {
      text: ({ message, defaultValue }: { message: string; defaultValue?: string }) => {
        options.promptTranscript?.text.push(message);
        const next = promptScript.text.shift();
        if (next === "__cancel__") {
          return Promise.reject(new UserCancelledError({ message: "User aborted the operation" }));
        }
        return Promise.resolve(next ?? defaultValue ?? "value");
      },
      password: ({ message }: { message: string }) => {
        options.promptTranscript?.password.push(message);
        const next = promptScript.password.shift();
        if (next === "__cancel__") {
          return Promise.reject(new UserCancelledError({ message: "User aborted the operation" }));
        }
        return Promise.resolve(next ?? "password");
      },
      select: <T extends string>({ message, options: selectOptions }: { message: string; options: { value: T }[] }) => {
        options.promptTranscript?.select.push({
          message,
          options: selectOptions.map((option) => option.value),
        });
        const next = promptScript.select.shift();
        if (next === "__cancel__") {
          return Promise.reject(new UserCancelledError({ message: "User aborted the operation" }));
        }
        if (next) {
          const match = selectOptions.find((option) => option.value === next);
          if (match) {
            return Promise.resolve(match.value);
          }
        }
        return Promise.resolve(selectOptions[0]?.value ?? ("" as T));
      },
      searchSelect: <T extends string>({
        message,
        options: searchOptions,
      }: {
        message: string;
        options: { value: T }[];
      }) => {
        options.promptTranscript?.searchSelect.push(message);
        const next = promptScript.searchSelect.shift();
        if (next === "__cancel__") {
          return Promise.reject(new UserCancelledError({ message: "User aborted the operation" }));
        }
        if (next) {
          const match = searchOptions.find((option) => option.value === next);
          if (match) {
            return Promise.resolve(match.value);
          }
        }
        return Promise.resolve(searchOptions[0]?.value ?? ("" as T));
      },
      multiSearchSelect: <T extends string>({
        message,
        options: searchOptions,
      }: {
        message: string;
        options: { value: T }[];
      }) => {
        options.promptTranscript?.multiSearchSelect.push(message);
        const next = promptScript.multiSearchSelect.shift();
        if (next) {
          return Promise.resolve(
            next.filter((value): value is T => searchOptions.some((option) => option.value === value)),
          );
        }
        return Promise.resolve(searchOptions.slice(0, 1).map((option) => option.value));
      },
      confirm: ({ message, initialValue }: { message: string; initialValue?: boolean }) => {
        options.promptTranscript?.confirm.push(message);
        return Promise.resolve(promptScript.confirm.shift() ?? initialValue ?? false);
      },
    }),
    Layer.succeed(ConsoleService, {
      info: (message: string) => {
        consoleTranscript?.info.push(message);
      },
      warn: (message: string) => {
        consoleTranscript?.warn.push(message);
      },
      error: (message: string) => {
        consoleTranscript?.error.push(message);
      },
      success: (message: string) => {
        consoleTranscript?.success.push(message);
      },
      note: (message: string, title?: string) => {
        consoleTranscript?.note.push({ message, title });
      },
    }),
    Layer.succeed(FileSystemService, {
      exists: (targetPath: string) =>
        Effect.tryPromise({
          try: () => fs.pathExists(targetPath),
          catch: (cause) =>
            new FileSystemError({
              message: `File system exists failed for ${targetPath}.`,
              operation: "exists",
              path: targetPath,
              cause,
            }),
        }),
      readdir: (targetPath: string) =>
        Effect.tryPromise({
          try: () => fs.readdir(targetPath),
          catch: (cause) =>
            new FileSystemError({
              message: `File system readdir failed for ${targetPath}.`,
              operation: "readdir",
              path: targetPath,
              cause,
            }),
        }),
      emptyDir: (targetPath: string) =>
        Effect.tryPromise({
          try: () => fs.emptyDir(targetPath),
          catch: (cause) =>
            new FileSystemError({
              message: `File system emptyDir failed for ${targetPath}.`,
              operation: "emptyDir",
              path: targetPath,
              cause,
            }),
        }),
      copyDir: (from: string, to: string, opts?: { overwrite?: boolean }) =>
        Effect.tryPromise({
          try: () => fs.copy(from, to, { overwrite: opts?.overwrite ?? true }),
          catch: (cause) =>
            new FileSystemError({
              message: `File system copyDir failed for ${from} -> ${to}.`,
              operation: "copyDir",
              path: `${from} -> ${to}`,
              cause,
            }),
        }),
      rename: (from: string, to: string) =>
        Effect.tryPromise({
          try: () => fs.rename(from, to),
          catch: (cause) =>
            new FileSystemError({
              message: `File system rename failed for ${from} -> ${to}.`,
              operation: "rename",
              path: `${from} -> ${to}`,
              cause,
            }),
        }),
      remove: (targetPath: string) =>
        Effect.tryPromise({
          try: () => fs.remove(targetPath),
          catch: (cause) =>
            new FileSystemError({
              message: `File system remove failed for ${targetPath}.`,
              operation: "remove",
              path: targetPath,
              cause,
            }),
        }),
      readJson: <T>(targetPath: string) =>
        Effect.tryPromise({
          try: () => fs.readJson(targetPath) as Promise<T>,
          catch: (cause) =>
            new FileSystemError({
              message: `File system readJson failed for ${targetPath}.`,
              operation: "readJson",
              path: targetPath,
              cause,
            }),
        }),
      writeJson: (targetPath: string, value: unknown) =>
        Effect.tryPromise({
          try: () => fs.writeJson(targetPath, value, { spaces: 2 }),
          catch: (cause) =>
            new FileSystemError({
              message: `File system writeJson failed for ${targetPath}.`,
              operation: "writeJson",
              path: targetPath,
              cause,
            }),
        }),
      writeFile: (targetPath: string, content: string) =>
        Effect.tryPromise({
          try: () => fs.writeFile(targetPath, content, "utf8"),
          catch: (cause) =>
            new FileSystemError({
              message: `File system writeFile failed for ${targetPath}.`,
              operation: "writeFile",
              path: targetPath,
              cause,
            }),
        }),
      readFile: (targetPath: string) =>
        Effect.tryPromise({
          try: () => fs.readFile(targetPath, "utf8"),
          catch: (cause) =>
            new FileSystemError({
              message: `File system readFile failed for ${targetPath}.`,
              operation: "readFile",
              path: targetPath,
              cause,
            }),
        }),
    }),
    Layer.succeed(TemplateService, {
      getTemplateDir: (appType: AppType, _ui: UIType) => {
        let templateName = "nextjs-shadcn";
        if (appType === "webviewer") {
          templateName = "vite-wv";
        }
        return path.resolve(__dirname, `../../cli/template/${templateName}`);
      },
    }),
    Layer.succeed(PackageManagerService, {
      getVersion: (packageManager: PackageManager) => {
        const failure = options.failures?.packageManagerGetVersion?.[packageManager];
        if (failure) {
          return Effect.fail(failure as ExternalCommandError);
        }
        return Effect.succeed("11.1.0");
      },
    }),
    Layer.succeed(ProcessService, {
      run: (command: string, args: string[]) => {
        const processCommand = [command, ...args].join(" ");
        tracker?.commands.push(processCommand);
        const processRunFailure = options.failures?.processRun;
        if (options.failProcessCommand === processCommand) {
          if (!processRunFailure) {
            throw new Error("makeTestLayer requires failures.processRun when failProcessCommand is set.");
          }
          return Effect.fail(processRunFailure as ExternalCommandError);
        }
        if (!options.failProcessCommand && processRunFailure) {
          return Effect.fail(processRunFailure as ExternalCommandError);
        }
        return Effect.succeed({ stdout: "", stderr: "" });
      },
    }),
    Layer.succeed(GitService, {
      initialize: () => {
        if (tracker) {
          tracker.gitInits += 1;
        }
        if (options.failures?.gitInitialize) {
          return Effect.fail(options.failures.gitInitialize as ExternalCommandError);
        }
        return Effect.void;
      },
    }),
    Layer.succeed(SettingsService, {
      writeSettings: (projectDir: string, settings: ProofKitSettings) =>
        Effect.tryPromise({
          try: () => fs.writeJson(path.join(projectDir, "proofkit.json"), settings, { spaces: 2 }),
          catch: (cause) =>
            new FileSystemError({
              message: "Unable to write ProofKit settings.",
              operation: "writeSettings",
              path: path.join(projectDir, "proofkit.json"),
              cause,
            }),
        }),
      appendEnvVars: (projectDir: string, vars: Record<string, string>) =>
        Effect.tryPromise({
          try: async () => {
            const envPath = path.join(projectDir, ".env");
            const existing = (await fs.pathExists(envPath)) ? await fs.readFile(envPath, "utf8") : "";
            const additions = Object.entries(vars)
              .map(([name, value]) => `${name}=${value}`)
              .join("\n");
            await fs.writeFile(
              envPath,
              [existing.trimEnd(), additions].filter(Boolean).join("\n").concat("\n"),
              "utf8",
            );
          },
          catch: (cause) =>
            new FileSystemError({
              message: "Unable to append env vars.",
              operation: "appendEnvVars",
              path: path.join(projectDir, ".env"),
              cause,
            }),
        }),
    }),
    Layer.succeed(FileMakerService, {
      detectLocalFmMcp: () => {
        const next = localFmMcpScript.shift() ?? lastLocalFmMcp;
        lastLocalFmMcp = next;
        return Effect.succeed({
          baseUrl: next?.baseUrl ?? "http://127.0.0.1:1365",
          healthy: next?.healthy ?? false,
          connectedFiles: next?.connectedFiles ?? [],
        });
      },
      installLocalWebViewerAddon: () => {
        if (tracker) {
          tracker.addonInstalls = (tracker.addonInstalls ?? 0) + 1;
        }
        return Effect.void;
      },
      authorizeLocalFmMcp: (input) => {
        tracker?.localFmMcpAuthorizations?.push({
          clientName: input.clientName,
          clientDescription: input.clientDescription,
        });
        return Effect.succeed({
          persistentToken: "test-persistent-token",
          persistentTokenEnvName: "FM_MCP_PERSISTENT_TOKEN",
        });
      },
      validateHostedServerUrl: (serverUrl: string) => {
        if (options.failures?.validateHostedServerUrl) {
          return Effect.fail(options.failures.validateHostedServerUrl as FileMakerSetupError);
        }
        return Effect.succeed({
          normalizedUrl: serverUrl,
          versions: {
            fmsVersion: "21.0.0",
            ottoVersion: "4.8.0",
          },
        });
      },
      getOttoFMSToken: () => Effect.succeed({ token: "admin_token" }),
      listFiles: () => Effect.succeed([{ filename: "Contacts.fmp12", status: "open" }]),
      listAPIKeys: () =>
        Effect.succeed([
          {
            key: "dk_existing",
            user: "Admin",
            database: "Contacts.fmp12",
            label: "Existing key",
          },
        ]),
      createDataAPIKeyWithCredentials: () => Effect.succeed({ apiKey: "dk_created" }),
      deployDemoFile: () => {
        if (options.failures?.deployDemoFile) {
          return Effect.fail(options.failures.deployDemoFile as FileMakerSetupError);
        }
        return Effect.succeed({ apiKey: "dk_demo", filename: "ProofKitDemo.fmp12" });
      },
      listLayouts: () => Effect.succeed(["API_Contacts", "Contacts"]),
      createFileMakerBootstrapArtifacts: (settings: ProofKitSettings, inputs: FileMakerInputs, appType: AppType) => {
        const envNames = createDataSourceEnvNames("filemaker");
        return Effect.succeed({
          settings: {
            ...settings,
            dataSources: [
              ...settings.dataSources,
              {
                type: "fm",
                name: "filemaker",
                envNames,
              },
            ],
          },
          envVars:
            inputs.mode === "hosted-otto"
              ? {
                  [envNames.database]: inputs.fileName,
                  [envNames.server]: inputs.server,
                  [envNames.apiKey]: inputs.dataApiKey,
                }
              : {},
          envSchemaEntries:
            inputs.mode === "hosted-otto"
              ? [
                  {
                    name: envNames.database,
                    zodSchema: 'z.string().endsWith(".fmp12")',
                    defaultValue: inputs.fileName,
                  },
                  { name: envNames.server, zodSchema: "z.string().url()", defaultValue: inputs.server },
                  { name: envNames.apiKey, zodSchema: 'z.string().startsWith("dk_")', defaultValue: inputs.dataApiKey },
                ]
              : [],
          typegenConfig: {
            mode: inputs.mode,
            dataSourceName: "filemaker",
            envNames: inputs.mode === "hosted-otto" ? envNames : undefined,
            fmMcpBaseUrl: inputs.mode === "local-fm-mcp" ? inputs.fmMcpBaseUrl : undefined,
            connectedFileName: inputs.mode === "local-fm-mcp" ? inputs.fileName : undefined,
            persistentTokenEnvName: inputs.mode === "local-fm-mcp" ? inputs.persistentTokenEnvName : undefined,
            layoutName: inputs.layoutName,
            schemaName: inputs.schemaName,
            appType,
          },
        });
      },
      bootstrap: (projectDir: string, settings: ProofKitSettings, inputs: FileMakerInputs, appType: AppType) =>
        Effect.tryPromise({
          try: async () => {
            if (tracker) {
              tracker.filemakerBootstraps += 1;
            }
            const nextSettings: ProofKitSettings = {
              ...settings,
              dataSources: [
                ...settings.dataSources,
                {
                  type: "fm",
                  name: "filemaker",
                  envNames: {
                    database: "FM_DATABASE",
                    server: "FM_SERVER",
                    apiKey: "OTTO_API_KEY",
                  },
                },
              ],
            };
            if (inputs.mode === "hosted-otto") {
              const envPath = path.join(projectDir, ".env");
              const content = (await fs.readFile(envPath, "utf8")).concat(
                `FM_DATABASE=${inputs.fileName}\nFM_SERVER=${inputs.server}\nOTTO_API_KEY=${inputs.dataApiKey}\n`,
              );
              await fs.writeFile(envPath, content, "utf8");
            } else if (inputs.persistentToken) {
              const envPath = path.join(projectDir, ".env");
              const content = (await fs.readFile(envPath, "utf8")).concat(
                `${inputs.persistentTokenEnvName ?? "FM_MCP_PERSISTENT_TOKEN"}=${inputs.persistentToken}\n`,
              );
              await fs.writeFile(envPath, content, "utf8");
            }
            await updateTypegenConfig(
              {
                exists: async (targetPath: string) => fs.pathExists(targetPath),
                readFile: async (targetPath: string) => fs.readFile(targetPath, "utf8"),
                writeFile: async (targetPath: string, content: string) => fs.writeFile(targetPath, content, "utf8"),
              },
              projectDir,
              {
                appType,
                dataSourceName: "filemaker",
                envNames: inputs.mode === "hosted-otto" ? createDataSourceEnvNames("filemaker") : undefined,
                fmMcpBaseUrl: inputs.mode === "local-fm-mcp" ? inputs.fmMcpBaseUrl : undefined,
                connectedFileName: inputs.mode === "local-fm-mcp" ? inputs.fileName : undefined,
                persistentTokenEnvName: inputs.mode === "local-fm-mcp" ? inputs.persistentTokenEnvName : undefined,
                layoutName: inputs.layoutName,
                schemaName: inputs.schemaName,
              },
            );
            return nextSettings;
          },
          catch: (cause) => new FileMakerSetupError({ message: "Unable to bootstrap FileMaker in test layer.", cause }),
        }),
    }),
    Layer.succeed(CodegenService, {
      runInitial: () => {
        if (tracker) {
          tracker.codegens += 1;
        }
        if (options.failures?.codegenRun) {
          return Effect.fail(options.failures.codegenRun as ExternalCommandError);
        }
        return Effect.void;
      },
    }),
  );

  return <A, E, R>(effect: Fx.Effect<A, E, R>) => Effect.provide(effect, layer);
}
