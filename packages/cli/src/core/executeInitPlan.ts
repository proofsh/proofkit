import path from "node:path";
import { Chalk } from "chalk";
import { Effect } from "effect";
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
import { UserAbortedError } from "~/core/errors.js";
import { applyPackageJsonMutations } from "~/core/planInit.js";
import type { InitPlan } from "~/core/types.js";
import { normalizeImportAlias, replaceTextInFiles } from "~/utils/projectFiles.js";

const AGENT_METADATA_DIRS = new Set([".agents", ".claude", ".clawed", ".clinerules", ".cursor", ".windsurf"]);
const IMPORT_ALIAS_WILDCARD_REGEX = /\*/g;
const IMPORT_ALIAS_TRAILING_SLASH_REGEX = /\/?$/;
const chalk = new Chalk({ level: 1 });

const formatCommand = (command: string) => chalk.cyan(command);
const formatHeading = (heading: string) => chalk.bold(heading);
const formatPath = (value: string) => chalk.yellow(value);

function renderNextSteps(plan: InitPlan) {
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

export const prepareDirectory = (plan: InitPlan) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService;
    const consoleService = yield* ConsoleService;
    const cliContext = yield* CliContext;
    const prompts = yield* PromptService;

    const exists = yield* Effect.promise(() => fs.exists(plan.targetDir));
    if (!exists) {
      return;
    }

    const entries = yield* Effect.promise(() => fs.readdir(plan.targetDir));
    const meaningfulEntries = getMeaningfulDirectoryEntries(entries);
    if (meaningfulEntries.length === 0) {
      return;
    }

    if (plan.request.force) {
      yield* Effect.promise(() => fs.emptyDir(plan.targetDir));
      return;
    }

    if (cliContext.nonInteractive) {
      throw new Error(
        `${plan.request.appDir} already exists and isn't empty. Remove the existing files or choose a different directory.`,
      );
    }

    const overwriteMode = yield* Effect.promise(() =>
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
      throw new UserAbortedError();
    }

    if (overwriteMode === "clear") {
      const confirmed = yield* Effect.promise(() =>
        prompts.confirm({
          message: "Are you sure you want to clear the directory?",
          initialValue: false,
        }),
      );
      if (!confirmed) {
        throw new UserAbortedError();
      }
      yield* Effect.promise(() => fs.emptyDir(plan.targetDir));
      return;
    }

    consoleService.warn(`Continuing in ${plan.request.appDir} and overwriting conflicting files when needed.`);
  });

export const executeInitPlan = (plan: InitPlan) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService;
    const consoleService = yield* ConsoleService;
    const settingsService = yield* SettingsService;
    const fileMakerService = yield* FileMakerService;
    const processService = yield* ProcessService;
    const gitService = yield* GitService;
    const codegenService = yield* CodegenService;
    const packageManagerService = yield* PackageManagerService;

    yield* prepareDirectory(plan);

    consoleService.info(`Scaffolding in ${plan.targetDir}`);
    yield* Effect.promise(() => fs.copyDir(plan.templateDir, plan.targetDir, { overwrite: true }));

    const stagedGitignore = path.join(plan.targetDir, "_gitignore");
    const finalGitignore = path.join(plan.targetDir, ".gitignore");
    if (yield* Effect.promise(() => fs.exists(stagedGitignore))) {
      if (yield* Effect.promise(() => fs.exists(finalGitignore))) {
        yield* Effect.promise(() => fs.remove(stagedGitignore));
      } else {
        yield* Effect.promise(() => fs.rename(stagedGitignore, finalGitignore));
      }
    }

    const packageJsonPath = path.join(plan.targetDir, "package.json");
    const packageJson = yield* Effect.promise(() => fs.readJson<Record<string, unknown>>(packageJsonPath));
    const updatedPackageJson = sortPackageJson(
      applyPackageJsonMutations(packageJson as never, plan.packageJson) as never,
    );
    yield* Effect.promise(() => fs.writeJson(packageJsonPath, updatedPackageJson));

    yield* Effect.promise(() => settingsService.writeSettings(plan.targetDir, plan.settings));
    yield* Effect.promise(() => fs.writeFile(plan.envFile.path, plan.envFile.content));
    for (const write of plan.writes) {
      yield* Effect.promise(() => fs.writeFile(write.path, write.content));
    }

    yield* Effect.promise(() => replaceTextInFiles(fs, plan.targetDir, "__PNPM_COMMAND__", plan.packageManagerCommand));
    yield* Effect.promise(() =>
      replaceTextInFiles(fs, plan.targetDir, "__PACKAGE_MANAGER__", plan.request.packageManager),
    );
    yield* Effect.promise(() => replaceTextInFiles(fs, plan.targetDir, "__AGENT_INSTRUCTIONS__", AGENT_INSTRUCTIONS));
    if (plan.request.importAlias !== "~/") {
      yield* Effect.promise(() =>
        replaceTextInFiles(fs, plan.targetDir, "~/", normalizeImportAlias(plan.request.importAlias)),
      );
      yield* Effect.promise(() =>
        replaceTextInFiles(
          fs,
          plan.targetDir,
          "@/",
          plan.request.importAlias
            .replace(IMPORT_ALIAS_WILDCARD_REGEX, "")
            .replace(IMPORT_ALIAS_TRAILING_SLASH_REGEX, "/"),
        ),
      );
    }

    let nextSettings = plan.settings;
    if (plan.tasks.bootstrapFileMaker && plan.request.fileMaker) {
      const fileMakerInputs = plan.request.fileMaker;
      nextSettings = yield* Effect.promise(() =>
        fileMakerService.bootstrap(plan.targetDir, nextSettings, fileMakerInputs, plan.request.appType),
      );
      yield* Effect.promise(() => settingsService.writeSettings(plan.targetDir, nextSettings));
    }

    if (plan.tasks.runInstall) {
      let installArgs: string[] = ["install"];
      if (plan.request.packageManager === "yarn") {
        installArgs = [];
      }
      yield* Effect.promise(() =>
        processService.run(plan.request.packageManager, installArgs, {
          cwd: plan.targetDir,
          stdout: "pipe",
          stderr: "pipe",
        }),
      );
    }

    if (plan.tasks.runInitialCodegen) {
      yield* Effect.promise(() => codegenService.runInitial(plan.targetDir, plan.request.packageManager));
    }

    if (plan.tasks.initializeGit) {
      yield* Effect.promise(() => gitService.initialize(plan.targetDir));
    }

    const packageManagerVersion = yield* Effect.promise(() =>
      packageManagerService.getVersion(plan.request.packageManager, plan.targetDir),
    );

    consoleService.success(
      `Created ${plan.request.scopedAppName} in ${plan.targetDir}${
        packageManagerVersion ? ` using ${plan.request.packageManager}@${packageManagerVersion}` : ""
      }`,
    );
    consoleService.info(chalk.bold("Next steps:"));
    consoleService.info(renderNextSteps(plan));
    return plan;
  });
