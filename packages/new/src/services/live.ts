import path from "node:path";
import { confirm, isCancel, log, note, select, text } from "@clack/prompts";
import { Effect, Layer } from "effect";
import { execa } from "execa";
import fs from "fs-extra";
import { TEMPLATE_ROOT } from "~/consts.js";
import {
  CliContext,
  type CliContextValue,
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
import { UserAbortedError } from "~/core/errors.js";
import type { AppType, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
import { detectUserPackageManager } from "~/utils/packageManager.js";

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new UserAbortedError();
  }
  return value as T;
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
  ensureTypegenConfig: async (projectDir: string, options: { appType: AppType; fileMaker?: FileMakerInputs }) => {
    const typegenPath = path.join(projectDir, "proofkit-typegen.config.jsonc");
    if (await fs.pathExists(typegenPath)) {
      const existing = await fs.readFile(typegenPath, "utf8");
      if (
        options.fileMaker?.layoutName &&
        options.fileMaker?.schemaName &&
        !existing.includes(options.fileMaker.layoutName)
      ) {
        const config = JSON.parse(existing.replace(/\/\/.*$/gm, "")) as {
          config:
            | {
                layouts?: Array<{ layoutName: string; schemaName: string }>;
              }
            | Array<{
                layouts?: Array<{ layoutName: string; schemaName: string }>;
              }>;
        };

        if (Array.isArray(config.config)) {
          config.config[0] ??= { layouts: [] };
          config.config[0].layouts ??= [];
          config.config[0].layouts.push({
            layoutName: options.fileMaker.layoutName,
            schemaName: options.fileMaker.schemaName,
          });
        } else {
          config.config.layouts ??= [];
          config.config.layouts.push({
            layoutName: options.fileMaker.layoutName,
            schemaName: options.fileMaker.schemaName,
          });
        }
        await fs.writeFile(typegenPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
      }
      return;
    }

    const nextConfig = {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: [
        {
          layouts:
            options.fileMaker?.layoutName && options.fileMaker?.schemaName
              ? [{ layoutName: options.fileMaker.layoutName, schemaName: options.fileMaker.schemaName }]
              : [],
          path: "./src/config/schemas/filemaker",
          clearOldFiles: true,
          clientSuffix: "Layout",
        },
      ],
    };
    await fs.writeFile(typegenPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  },
};

const fileMakerService = {
  bootstrap: async (projectDir: string, settings: ProofKitSettings, inputs: FileMakerInputs) => {
    const dataSource = {
      type: "fm" as const,
      name: "filemaker",
      envNames: {
        database: "FM_DATABASE",
        server: "FM_SERVER",
        apiKey: "OTTO_API_KEY",
      },
    };

    await settingsService.appendEnvVars(projectDir, {
      FM_DATABASE: inputs.fileName,
      FM_SERVER: inputs.server,
      OTTO_API_KEY: inputs.dataApiKey,
    });

    return {
      ...settings,
      dataSources: settings.dataSources.some((entry) => entry.name === dataSource.name)
        ? settings.dataSources
        : [...settings.dataSources, dataSource],
    };
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
