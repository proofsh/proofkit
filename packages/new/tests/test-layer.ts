import path from "node:path";
import { fileURLToPath } from "node:url";
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
import type { AppType, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
import type { PackageManager } from "~/utils/packageManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function makeTestLayer(options: {
  cwd: string;
  packageManager: PackageManager;
  tracker?: {
    commands: string[];
    gitInits: number;
    codegens: number;
    filemakerBootstraps: number;
  };
}) {
  const tracker = options.tracker;

  const layer = Layer.mergeAll(
    Layer.succeed(CliContext, {
      cwd: options.cwd,
      debug: false,
      nonInteractive: true,
      packageManager: options.packageManager,
    }),
    Layer.succeed(PromptService, {
      text: async ({ defaultValue }: { defaultValue?: string }) => defaultValue ?? "value",
      select: async <T extends string>({ options }: { options: Array<{ value: T }> }) => options[0]?.value ?? ("" as T),
      confirm: async ({ initialValue }: { initialValue?: boolean }) => initialValue ?? false,
    }),
    Layer.succeed(ConsoleService, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      success: () => undefined,
      note: () => undefined,
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
      bootstrap: async (projectDir: string, settings: ProofKitSettings, inputs: FileMakerInputs) => {
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
        const envPath = path.join(projectDir, ".env");
        const content = (await fs.readFile(envPath, "utf8")).concat(
          `FM_DATABASE=${inputs.fileName}\nFM_SERVER=${inputs.server}\nOTTO_API_KEY=${inputs.dataApiKey}\n`,
        );
        await fs.writeFile(envPath, content, "utf8");
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
