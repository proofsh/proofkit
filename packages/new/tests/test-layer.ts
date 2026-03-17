import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Layer } from "effect";
import fs from "fs-extra";
import {
  CliContext,
  CodegenService,
  ConsoleService,
  type FileMakerBootstrapArtifacts,
  FileMakerService,
  FileSystemService,
  GitService,
  PackageManagerService,
  ProcessService,
  PromptService,
  SettingsService,
  TemplateService,
} from "~/core/context.js";
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
}

export interface ConsoleTranscript {
  info: string[];
  warn: string[];
  error: string[];
  success: string[];
  note: Array<{ message: string; title?: string }>;
}

export function makeTestLayer(options: {
  cwd: string;
  packageManager: PackageManager;
  nonInteractive?: boolean;
  prompts?: PromptScript;
  console?: ConsoleTranscript;
  tracker?: {
    commands: string[];
    gitInits: number;
    codegens: number;
    filemakerBootstraps: number;
  };
  fileMaker?: {
    localFmHttp?: {
      healthy: boolean;
      baseUrl?: string;
      connectedFiles?: string[];
    };
  };
}) {
  const tracker = options.tracker;
  const promptScript = {
    text: [...(options.prompts?.text ?? [])],
    select: [...(options.prompts?.select ?? [])],
    confirm: [...(options.prompts?.confirm ?? [])],
    password: [...(options.prompts?.password ?? [])],
    searchSelect: [...(options.prompts?.searchSelect ?? [])],
  };
  const consoleTranscript = options.console;

  const layer = Layer.mergeAll(
    Layer.succeed(CliContext, {
      cwd: options.cwd,
      debug: false,
      nonInteractive: options.nonInteractive ?? true,
      packageManager: options.packageManager,
    }),
    Layer.succeed(PromptService, {
      text: ({ defaultValue }: { defaultValue?: string }) => {
        const next = promptScript.text.shift();
        return Promise.resolve(next ?? defaultValue ?? "value");
      },
      password: () => Promise.resolve(promptScript.password.shift() ?? "password"),
      select: <T extends string>({ options }: { options: { value: T }[] }) => {
        const next = promptScript.select.shift();
        if (next) {
          const match = options.find((option) => option.value === next);
          if (match) {
            return Promise.resolve(match.value);
          }
        }
        return Promise.resolve(options[0]?.value ?? ("" as T));
      },
      searchSelect: <T extends string>({ options }: { options: { value: T }[] }) => {
        const next = promptScript.searchSelect.shift();
        if (next) {
          const match = options.find((option) => option.value === next);
          if (match) {
            return Promise.resolve(match.value);
          }
        }
        return Promise.resolve(options[0]?.value ?? ("" as T));
      },
      confirm: async ({ initialValue }: { initialValue?: boolean }) =>
        promptScript.confirm.shift() ?? initialValue ?? false,
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
      exists: async (targetPath: string) => fs.pathExists(targetPath),
      readdir: async (targetPath: string) => fs.readdir(targetPath),
      emptyDir: async (targetPath: string) => fs.emptyDir(targetPath),
      copyDir: async (from: string, to: string, opts?: { overwrite?: boolean }) =>
        fs.copy(from, to, { overwrite: opts?.overwrite ?? true }),
      rename: async (from: string, to: string) => fs.rename(from, to),
      remove: async (targetPath: string) => fs.remove(targetPath),
      readJson: async <T>(targetPath: string) => fs.readJson(targetPath) as Promise<T>,
      writeJson: async (targetPath: string, value: unknown) => fs.writeJson(targetPath, value, { spaces: 2 }),
      writeFile: async (targetPath: string, content: string) => fs.writeFile(targetPath, content, "utf8"),
      readFile: async (targetPath: string) => fs.readFile(targetPath, "utf8"),
    }),
    Layer.succeed(TemplateService, {
      getTemplateDir: (appType: AppType, ui: UIType) => {
        let templateName = "nextjs-shadcn";
        if (appType === "webviewer") {
          templateName = "vite-wv";
        } else if (ui === "mantine") {
          templateName = "nextjs-mantine";
        }
        return path.resolve(__dirname, `../../cli/template/${templateName}`);
      },
    }),
    Layer.succeed(PackageManagerService, {
      getVersion: async () => "10.27.0",
    }),
    Layer.succeed(ProcessService, {
      run: (command: string, args: string[]) => {
        tracker?.commands.push([command, ...args].join(" "));
        return Promise.resolve({ stdout: "", stderr: "" });
      },
    }),
    Layer.succeed(GitService, {
      initialize: () => {
        if (tracker) {
          tracker.gitInits += 1;
        }
        return Promise.resolve();
      },
    }),
    Layer.succeed(SettingsService, {
      writeSettings: async (projectDir: string, settings: ProofKitSettings) =>
        fs.writeJson(path.join(projectDir, "proofkit.json"), settings, { spaces: 2 }),
      appendEnvVars: async (projectDir: string, vars: Record<string, string>) => {
        const envPath = path.join(projectDir, ".env");
        const existing = (await fs.pathExists(envPath)) ? await fs.readFile(envPath, "utf8") : "";
        const additions = Object.entries(vars)
          .map(([name, value]) => `${name}=${value}`)
          .join("\n");
        await fs.writeFile(envPath, [existing.trimEnd(), additions].filter(Boolean).join("\n").concat("\n"), "utf8");
      },
      ensureTypegenConfig: async (projectDir: string, options: { appType: AppType; fileMaker?: FileMakerInputs }) => {
        const typegenPath = path.join(projectDir, "proofkit-typegen.config.jsonc");
        if (!(await fs.pathExists(typegenPath))) {
          await fs.writeFile(typegenPath, `${JSON.stringify({ config: { layouts: [] } }, null, 2)}\n`, "utf8");
        }
        if (options.fileMaker?.layoutName && options.fileMaker?.schemaName) {
          const parsed = JSON.parse(await fs.readFile(typegenPath, "utf8")) as {
            config:
              | { layouts?: Array<{ layoutName: string; schemaName: string }> }
              | Array<{ layouts?: Array<{ layoutName: string; schemaName: string }> }>;
          };
          let layouts: Array<{ layoutName: string; schemaName: string }>;
          if (Array.isArray(parsed.config)) {
            const firstConfig = parsed.config[0] ?? {};
            firstConfig.layouts ??= [];
            parsed.config[0] = firstConfig;
            layouts = firstConfig.layouts;
          } else {
            parsed.config.layouts ??= [];
            layouts = parsed.config.layouts;
          }
          layouts.push({
            layoutName: options.fileMaker.layoutName,
            schemaName: options.fileMaker.schemaName,
          });
          await fs.writeFile(typegenPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
        }
      },
    }),
    Layer.succeed(FileMakerService, {
      detectLocalFmHttp: async () => ({
        baseUrl: options.fileMaker?.localFmHttp?.baseUrl ?? "http://127.0.0.1:1365",
        healthy: options.fileMaker?.localFmHttp?.healthy ?? false,
        connectedFiles: options.fileMaker?.localFmHttp?.connectedFiles ?? [],
      }),
      validateHostedServerUrl: async (serverUrl: string) => ({
        normalizedUrl: serverUrl,
        versions: {
          fmsVersion: "21.0.0",
          ottoVersion: "4.8.0",
        },
      }),
      getOttoFMSToken: async () => ({ token: "admin_token" }),
      listFiles: async () => [{ filename: "Contacts.fmp12", status: "open" }],
      listAPIKeys: async () => [
        {
          key: "dk_existing",
          user: "Admin",
          database: "Contacts.fmp12",
          label: "Existing key",
        },
      ],
      createDataAPIKeyWithCredentials: async () => ({ apiKey: "dk_created" }),
      deployDemoFile: async () => ({ apiKey: "dk_demo", filename: "ProofKitDemo.fmp12" }),
      listLayouts: async () => ["API_Contacts", "Contacts"],
      createFileMakerBootstrapArtifacts: (
        settings: ProofKitSettings,
        inputs: FileMakerInputs,
        appType: AppType,
      ): Promise<FileMakerBootstrapArtifacts> => {
        const envNames = createDataSourceEnvNames("filemaker");
        return Promise.resolve({
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
            fmHttpBaseUrl: inputs.mode === "local-fm-http" ? inputs.fmHttpBaseUrl : undefined,
            connectedFileName: inputs.mode === "local-fm-http" ? inputs.fileName : undefined,
            layoutName: inputs.layoutName,
            schemaName: inputs.schemaName,
            appType,
          },
        });
      },
      bootstrap: async (projectDir: string, settings: ProofKitSettings, inputs: FileMakerInputs, appType: AppType) => {
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
            fmHttpBaseUrl: inputs.mode === "local-fm-http" ? inputs.fmHttpBaseUrl : undefined,
            connectedFileName: inputs.mode === "local-fm-http" ? inputs.fileName : undefined,
            layoutName: inputs.layoutName,
            schemaName: inputs.schemaName,
          },
        );
        return nextSettings;
      },
    }),
    Layer.succeed(CodegenService, {
      runInitial: () => {
        if (tracker) {
          tracker.codegens += 1;
        }
        return Promise.resolve();
      },
    }),
  );

  return <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, layer);
}
