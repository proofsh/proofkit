import path from "node:path";
import { Chalk } from "chalk";
import { Cause, Effect, Exit } from "effect";
import { getOrUndefined } from "effect/Option";
import sortPackageJson from "sort-package-json";

import { AGENT_INSTRUCTIONS } from "~/consts.js";
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
} from "~/core/context.js";
import { DirectoryConflictError, FileSystemError, isCliError, UserCancelledError } from "~/core/errors.js";
import { applyPackageJsonMutations } from "~/core/planInit.js";
import type { InitPlan } from "~/core/types.js";
import { normalizeImportAlias, replaceTextInFiles, updateTypegenConfig } from "~/utils/projectFiles.js";

const AGENT_METADATA_DIRS = new Set([".agents", ".claude", ".clawed", ".clinerules", ".cursor", ".windsurf"]);
const IMPORT_ALIAS_WILDCARD_REGEX = /\*/g;
const IMPORT_ALIAS_TRAILING_SLASH_REGEX = /\/?$/;
const chalk = new Chalk({ level: 1 });

const formatCommand = (command: string) => chalk.cyan(command);
const formatHeading = (heading: string) => chalk.bold(heading);
const formatPath = (value: string) => chalk.yellow(value);

function renderNextSteps(plan: InitPlan, additionalSteps: string[] = []) {
  const lines = [
    `${formatHeading("Project root:")} ${formatCommand(`cd ${formatPath(plan.request.appDir)}`)}`,
    "",
    formatHeading("Agent setup:"),
    "Have your agent run this in the new project and complete the interactive prompt so it can load the right skills:",
    `  ${formatCommand("npx @tanstack/intent@latest install")}`,
  ];

  if (plan.request.noInstall) {
    lines.push(
      "",
      formatHeading("Install dependencies:"),
      `  ${formatCommand(plan.request.packageManager === "yarn" ? "yarn" : `${plan.request.packageManager} install`)}`,
    );
  }

  lines.push("", formatHeading("Start the app:"), `  ${formatCommand(`${plan.packageManagerCommand} dev`)}`);

  if (plan.request.appType === "webviewer") {
    lines.push(
      "",
      formatHeading("When your FileMaker file is ready:"),
      `  ${formatCommand(`${plan.packageManagerCommand} typegen`)}`,
      `  ${formatCommand(`${plan.packageManagerCommand} launch-fm`)}`,
    );

    if (additionalSteps.length > 0) {
      lines.push(...additionalSteps.map((step) => `  ${formatCommand(step)}`));
    }
  }

  lines.push(
    "",
    formatHeading("More ProofKit commands:"),
    `  ${formatCommand(`${plan.packageManagerCommand} proofkit`)}`,
  );

  return lines.join("\n");
}

function getMeaningfulDirectoryEntries(entries: string[]) {
  return entries.filter((entry) => {
    if (AGENT_METADATA_DIRS.has(entry)) {
      return false;
    }
    if (entry === ".gitignore") {
      return true;
    }
    if (entry.startsWith(".")) {
      return false;
    }
    return true;
  });
}

function promptEffect<A>(message: string, run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      isCliError(cause)
        ? cause
        : new DirectoryConflictError({
            message,
            path: "",
          }),
  });
}

export const prepareDirectory = (plan: InitPlan) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService;
    const consoleService = yield* ConsoleService;
    const cliContext = yield* CliContext;
    const prompts = yield* PromptService;

    const exists = yield* fs.exists(plan.targetDir);
    if (!exists) {
      return;
    }

    const entries = yield* fs.readdir(plan.targetDir);
    const meaningfulEntries = getMeaningfulDirectoryEntries(entries);
    if (meaningfulEntries.length === 0) {
      return;
    }

    if (plan.request.force) {
      yield* fs.emptyDir(plan.targetDir);
      return;
    }

    if (cliContext.nonInteractive) {
      return yield* Effect.fail(
        new DirectoryConflictError({
          message: `${plan.request.appDir} already exists and isn't empty. Remove the existing files or choose a different directory.`,
          path: plan.targetDir,
        }),
      );
    }

    const overwriteMode = yield* promptEffect("Unable to choose how to handle the existing directory.", () =>
      prompts.select({
        message: `${plan.request.appDir} already exists and isn't empty. How would you like to proceed?`,
        options: [
          { value: "abort", label: "Abort installation" },
          { value: "clear", label: "Clear the directory and continue" },
          { value: "overwrite", label: "Continue and overwrite conflicting files" },
        ],
      }),
    );

    if (overwriteMode === "abort") {
      return yield* Effect.fail(
        new UserCancelledError({
          message: "User aborted the operation",
        }),
      );
    }

    if (overwriteMode === "clear") {
      const confirmed = yield* promptEffect("Unable to confirm directory clearing.", () =>
        prompts.confirm({
          message: "Are you sure you want to clear the directory?",
          initialValue: false,
        }),
      );
      if (!confirmed) {
        return yield* Effect.fail(
          new UserCancelledError({
            message: "User aborted the operation",
          }),
        );
      }
      yield* fs.emptyDir(plan.targetDir);
      return;
    }

    consoleService.warn(`Continuing in ${plan.request.appDir} and overwriting conflicting files when needed.`);
  });

export const executeInitPlan = (plan: InitPlan) =>
  Effect.gen(function* () {
    const cliContext = yield* CliContext;
    const fs = yield* FileSystemService;
    const consoleService = yield* ConsoleService;
    const settingsService = yield* SettingsService;
    const fileMakerService = yield* FileMakerService;
    const processService = yield* ProcessService;
    const gitService = yield* GitService;
    const codegenService = yield* CodegenService;
    const packageManagerService = yield* PackageManagerService;
    const additionalNextSteps: string[] = [];
    const runFileSystemPromise = async <A>(effect: Effect.Effect<A, unknown>) => {
      const exit = await Effect.runPromiseExit(effect);
      if (Exit.isSuccess(exit)) {
        return exit.value;
      }

      const failure = getOrUndefined(Cause.failureOption(exit.cause));
      if (failure && typeof failure === "object" && failure !== null && "cause" in failure) {
        throw failure.cause;
      }

      throw failure ?? Cause.squash(exit.cause);
    };
    const projectFilesFs = {
      exists: (targetPath: string) => runFileSystemPromise(fs.exists(targetPath)),
      readdir: (targetPath: string) => runFileSystemPromise(fs.readdir(targetPath)),
      readFile: (targetPath: string) => runFileSystemPromise(fs.readFile(targetPath)),
      writeFile: (targetPath: string, content: string) => runFileSystemPromise(fs.writeFile(targetPath, content)),
    };

    yield* prepareDirectory(plan);

    consoleService.info(`Scaffolding in ${plan.targetDir}`);
    yield* fs.copyDir(plan.templateDir, plan.targetDir, { overwrite: true });

    const stagedGitignore = path.join(plan.targetDir, "_gitignore");
    const finalGitignore = path.join(plan.targetDir, ".gitignore");
    if (yield* fs.exists(stagedGitignore)) {
      if (yield* fs.exists(finalGitignore)) {
        yield* fs.remove(stagedGitignore);
      } else {
        yield* fs.rename(stagedGitignore, finalGitignore);
      }
    }

    const packageJsonPath = path.join(plan.targetDir, "package.json");
    const packageJson = yield* fs.readJson<Record<string, unknown>>(packageJsonPath);
    const updatedPackageJson = sortPackageJson(
      applyPackageJsonMutations(packageJson as never, plan.packageJson) as never,
    );
    yield* fs.writeJson(packageJsonPath, updatedPackageJson);

    yield* settingsService.writeSettings(plan.targetDir, plan.settings);
    yield* fs.writeFile(plan.envFile.path, plan.envFile.content);
    for (const write of plan.writes) {
      yield* fs.writeFile(write.path, write.content);
    }

    yield* Effect.tryPromise({
      try: () => replaceTextInFiles(projectFilesFs, plan.targetDir, "__PNPM_COMMAND__", plan.packageManagerCommand),
      catch: (cause) =>
        new FileSystemError({
          message: "Unable to rewrite scaffold placeholders.",
          operation: "replaceTextInFiles",
          path: plan.targetDir,
          cause,
        }),
    });
    yield* Effect.tryPromise({
      try: () => replaceTextInFiles(projectFilesFs, plan.targetDir, "__PACKAGE_MANAGER__", plan.request.packageManager),
      catch: (cause) =>
        new FileSystemError({
          message: "Unable to rewrite scaffold placeholders.",
          operation: "replaceTextInFiles",
          path: plan.targetDir,
          cause,
        }),
    });
    yield* Effect.tryPromise({
      try: () => replaceTextInFiles(projectFilesFs, plan.targetDir, "__AGENT_INSTRUCTIONS__", AGENT_INSTRUCTIONS),
      catch: (cause) =>
        new FileSystemError({
          message: "Unable to rewrite scaffold placeholders.",
          operation: "replaceTextInFiles",
          path: plan.targetDir,
          cause,
        }),
    });
    if (plan.request.importAlias !== "~/") {
      yield* Effect.tryPromise({
        try: () =>
          replaceTextInFiles(projectFilesFs, plan.targetDir, "~/", normalizeImportAlias(plan.request.importAlias)),
        catch: (cause) =>
          new FileSystemError({
            message: "Unable to rewrite scaffold import aliases.",
            operation: "replaceTextInFiles",
            path: plan.targetDir,
            cause,
          }),
      });
      yield* Effect.tryPromise({
        try: () =>
          replaceTextInFiles(
            projectFilesFs,
            plan.targetDir,
            "@/",
            plan.request.importAlias
              .replace(IMPORT_ALIAS_WILDCARD_REGEX, "")
              .replace(IMPORT_ALIAS_TRAILING_SLASH_REGEX, "/"),
          ),
        catch: (cause) =>
          new FileSystemError({
            message: "Unable to rewrite scaffold import aliases.",
            operation: "replaceTextInFiles",
            path: plan.targetDir,
            cause,
          }),
      });
    }

    let nextSettings = plan.settings;
    if (plan.tasks.bootstrapFileMaker && plan.request.fileMaker) {
      const fileMakerInputs = plan.request.fileMaker;
      nextSettings = yield* fileMakerService.bootstrap(
        plan.targetDir,
        nextSettings,
        fileMakerInputs,
        plan.request.appType,
      );
      yield* settingsService.writeSettings(plan.targetDir, nextSettings);
    }

    if (plan.request.appType === "webviewer" && !plan.tasks.bootstrapFileMaker) {
      const localFmMcp = yield* fileMakerService.detectLocalFmMcp();
      const connectedFiles = localFmMcp.connectedFiles.filter(Boolean);
      if (localFmMcp.healthy && connectedFiles.length === 1) {
        const detectedFile = connectedFiles[0];
        if (detectedFile) {
          yield* Effect.tryPromise({
            try: () =>
              updateTypegenConfig(projectFilesFs, plan.targetDir, {
                appType: "webviewer",
                dataSourceName: "filemaker",
                fmMcpBaseUrl: localFmMcp.baseUrl,
                connectedFileName: detectedFile,
              }),
            catch: (cause) =>
              new FileSystemError({
                message: "Unable to persist local FileMaker file detection into typegen config.",
                operation: "updateTypegenConfig",
                path: plan.targetDir,
                cause,
              }),
          });
        }
      }
    }

    if (plan.tasks.checkWebViewerAddon) {
      yield* Effect.promise(async () => {
        try {
          const { checkForWebViewerLayouts, getWebViewerAddonMessages } = await import(
            "~/installers/proofkit-webviewer.js"
          );
          const status = await checkForWebViewerLayouts(plan.targetDir);
          const messages = getWebViewerAddonMessages(status);

          for (const message of messages.warn) {
            consoleService.warn(message);
          }
          for (const message of messages.info) {
            consoleService.info(message);
          }
          if (cliContext.nonInteractive) {
            additionalNextSteps.push(...messages.nextSteps);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          consoleService.warn(`Could not inspect the ProofKit Web Viewer add-on (${message}).`);
        }
      });
    }

    if (plan.tasks.runInstall) {
      let installArgs: string[] = ["install"];
      if (plan.request.packageManager === "yarn") {
        installArgs = [];
      }
      yield* processService.run(plan.request.packageManager, installArgs, {
        cwd: plan.targetDir,
        stdout: "pipe",
        stderr: "pipe",
      });
    }

    if (plan.tasks.runInitialCodegen) {
      yield* codegenService.runInitial(plan.targetDir, plan.request.packageManager);
    }

    if (plan.tasks.initializeGit) {
      yield* gitService.initialize(plan.targetDir);
    }

    const packageManagerVersion = yield* packageManagerService.getVersion(plan.request.packageManager, plan.targetDir);

    consoleService.success(
      `Created ${plan.request.scopedAppName} in ${plan.targetDir}${
        packageManagerVersion ? ` using ${plan.request.packageManager}@${packageManagerVersion}` : ""
      }`,
    );
    consoleService.info(chalk.bold("Next steps:"));
    consoleService.info(renderNextSteps(plan, Array.from(new Set(additionalNextSteps))));
    return plan;
  });
