#!/usr/bin/env node
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { optional as optionalArg, text as textArg, withDescription as withArgDescription } from "@effect/cli/Args";
import {
  make as makeCommand,
  run,
  withDescription as withCommandDescription,
  withSubcommands,
} from "@effect/cli/Command";
import {
  boolean as booleanOption,
  choice as choiceOption,
  optional as optionalOption,
  text as textOption,
  withAlias,
  withDescription as withOptionDescription,
} from "@effect/cli/Options";
import { isValidationError } from "@effect/cli/ValidationError";
import { layer as nodeContextLayer } from "@effect/platform-node/NodeContext";
import { Cause, Effect, Exit } from "effect";
import { getOrUndefined } from "effect/Option";
import { cliName } from "~/consts.js";
import {
  CliContext,
  ConsoleService,
  FileSystemService,
  PackageManagerService,
  PromptService,
  TemplateService,
} from "~/core/context.js";
import { runDoctor } from "~/core/doctor.js";
import { getCliErrorMessage, isCliError, NonInteractiveInputError, UserCancelledError } from "~/core/errors.js";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { runPrompt } from "~/core/prompt.js";
import { resolveInitRequest } from "~/core/resolveInitRequest.js";
import type { CliFlags } from "~/core/types.js";
import { CLI_VERSION } from "~/generated/package-versions.js";
import { makeLiveLayer } from "~/services/live.js";
import { resolveNonInteractiveMode } from "~/utils/nonInteractive.js";
import { intro } from "~/utils/prompts.js";
import { proofGradient, renderTitle } from "~/utils/renderTitle.js";

const defaultCliFlags: CliFlags = {
  noGit: false,
  noInstall: false,
  force: false,
  default: false,
  CI: false,
  importAlias: "~/",
};

function getCliVersion() {
  return CLI_VERSION;
}

export const runInit = (name?: string, rawFlags?: Partial<CliFlags>) =>
  Effect.gen(function* () {
    const templateService = yield* TemplateService;
    const packageManagerService = yield* PackageManagerService;
    const request = yield* resolveInitRequest(name, { ...defaultCliFlags, ...rawFlags });
    const templateDir = templateService.getTemplateDir(request.appType, request.ui);
    const packageManagerVersion = yield* packageManagerService.getVersion(request.packageManager, request.cwd);
    const plan = planInit(request, { templateDir, packageManagerVersion });
    yield* executeInitPlan(plan);
    return { request, plan };
  });

type ProjectMenuChoice = "add" | "remove" | "typegen" | "deploy" | "upgrade" | "doctor" | "prompt" | "docs";

function isPromptCancellationError(error: unknown) {
  return error instanceof UserCancelledError || (error instanceof Error && error.name === "ExitPromptError");
}

function toProjectMenuCommandError(command: string, cause: unknown) {
  if (isCliError(cause)) {
    return cause;
  }

  const error = new Error(`Failed to run \`${command}\` from project menu.`);
  Object.assign(error, { cause });
  return error;
}

const runProjectMenu = Effect.gen(function* () {
  const prompt = yield* PromptService;
  const consoleService = yield* ConsoleService;

  const menuChoice = yield* Effect.tryPromise({
    try: () =>
      prompt.select<ProjectMenuChoice>({
        message: "What would you like to do?",
        options: [
          {
            label: "Add Components",
            value: "add",
            hint: "Add new pages, schemas, data sources, etc.",
          },
          {
            label: "Remove Components",
            value: "remove",
            hint: "Remove pages, schemas, data sources, etc.",
          },
          {
            label: "Generate Types",
            value: "typegen",
            hint: "Update field definitions from your data sources",
          },
          {
            label: "Deploy",
            value: "deploy",
            hint: "Deploy your app to Vercel",
          },
          {
            label: "Upgrade Components",
            value: "upgrade",
            hint: "Update ProofKit components to latest version",
          },
          {
            label: "Doctor",
            value: "doctor",
            hint: "Inspect project health and next steps",
          },
          {
            label: "Prompt",
            value: "prompt",
            hint: "Show agent workflow guidance",
          },
          {
            label: "View Documentation",
            value: "docs",
            hint: "Open ProofKit documentation",
          },
        ],
      }),
    catch: (cause) =>
      isPromptCancellationError(cause)
        ? new UserCancelledError({ message: "User aborted the operation" })
        : toProjectMenuCommandError("menu selection", cause),
  });

  switch (menuChoice) {
    case "doctor":
      return yield* runDoctor;
    case "prompt":
      return yield* runPrompt;
    case "docs": {
      const { DOCS_URL } = yield* Effect.promise(() => import("~/consts.js"));
      consoleService.info(`Opening ${DOCS_URL} in your browser...`);
      const { default: open } = yield* Effect.promise(() => import("open"));
      yield* Effect.promise(() => open(DOCS_URL));
      return;
    }
    case "add":
      return yield* Effect.tryPromise({
        try: async () => {
          const [{ runAdd }, { initProgramState, state }] = await Promise.all([
            import("~/cli/add/index.js"),
            import("~/state.js"),
          ]);
          initProgramState({});
          state.baseCommand = "add";
          state.projectDir = process.cwd();
          await runAdd(undefined);
        },
        catch: (cause) => toProjectMenuCommandError("add", cause),
      });
    case "remove":
      return yield* Effect.tryPromise({
        try: async () => {
          const [{ runRemove }, { initProgramState, state }] = await Promise.all([
            import("~/cli/remove/index.js"),
            import("~/state.js"),
          ]);
          initProgramState({});
          state.baseCommand = "remove";
          state.projectDir = process.cwd();
          await runRemove(undefined);
        },
        catch: (cause) => toProjectMenuCommandError("remove", cause),
      });
    case "typegen":
      return yield* Effect.promise(async () => {
        const [{ runTypegen }, { getSettings }, { state }] = await Promise.all([
          import("~/cli/typegen/index.js"),
          import("~/utils/parseSettings.js"),
          import("~/state.js"),
        ]);
        state.projectDir = process.cwd();
        await runTypegen({ settings: getSettings() });
      });
    case "deploy":
      return yield* Effect.promise(async () => {
        const [{ runDeploy }, { initProgramState, state }] = await Promise.all([
          import("~/cli/deploy/index.js"),
          import("~/state.js"),
        ]);
        initProgramState({});
        state.baseCommand = "deploy";
        state.projectDir = process.cwd();
        await runDeploy();
      });
    case "upgrade":
      return yield* Effect.promise(async () => {
        const [{ runUpgrade }, { initProgramState, state }] = await Promise.all([
          import("~/cli/update/index.js"),
          import("~/state.js"),
        ]);
        initProgramState({});
        state.baseCommand = "upgrade";
        state.projectDir = process.cwd();
        await runUpgrade();
      });
    default:
      throw new Error(`Unknown menu choice: ${menuChoice}`);
  }
});

export const runDefaultCommand = (rawFlags?: Partial<CliFlags>) =>
  Effect.gen(function* () {
    const cliContext = yield* CliContext;
    const fsService = yield* FileSystemService;
    const consoleService = yield* ConsoleService;
    const flags = { ...defaultCliFlags, ...rawFlags };
    const settingsPath = path.join(cliContext.cwd, "proofkit.json");
    const hasProofKitProject = yield* fsService.exists(settingsPath);

    if (hasProofKitProject) {
      intro(`Found ${proofGradient("ProofKit")} project`);
      if (!(cliContext.nonInteractive || flags.CI || flags.nonInteractive)) {
        return yield* runProjectMenu;
      }

      consoleService.note(
        [
          "ProofKit now focuses on project bootstrap, diagnostics, and agent entrypoints.",
          "Use an explicit command such as `proofkit doctor`, `proofkit prompt`, or `proofkit init`.",
        ].join("\n"),
        "Project commands",
      );
      return;
    }

    if (cliContext.nonInteractive || flags.CI || flags.nonInteractive) {
      return yield* Effect.fail(
        new NonInteractiveInputError({
          message:
            "The default command is interactive-only in non-interactive mode. Run an explicit command such as `proofkit init <name> --non-interactive`.",
        }),
      );
    }

    intro(`No ${proofGradient("ProofKit")} project found, running \`init\``);
    yield* runInit(undefined, {
      ...flags,
      default: true,
    });
  });

const initDirectoryArg = optionalArg(textArg({ name: "dir" })).pipe(
  withArgDescription("The project name or target directory. Use `.` for the current directory, best when it is empty."),
);

function optionalTextOption(name: string, description: string) {
  return optionalOption(textOption(name).pipe(withOptionDescription(description)));
}

function optionalChoiceOption<Choices extends readonly string[]>(name: string, choices: Choices, description: string) {
  return optionalOption(choiceOption(name, choices).pipe(withOptionDescription(description)));
}

function getCurrentTTYState() {
  return {
    stdinIsTTY: process.stdin?.isTTY,
    stdoutIsTTY: process.stdout?.isTTY,
  };
}

function legacyEffect<T>(runLegacy: () => Promise<T>, options?: { nonInteractive?: boolean; debug?: boolean }) {
  const nonInteractive = resolveNonInteractiveMode({
    nonInteractive: options?.nonInteractive,
    ...getCurrentTTYState(),
  });

  return makeLiveLayer({
    cwd: process.cwd(),
    debug: options?.debug === true,
    nonInteractive,
  })(Effect.promise(runLegacy));
}

function makeInitCommand() {
  return makeCommand(
    "init",
    {
      dir: initDirectoryArg,
      appType: optionalChoiceOption("app-type", ["browser", "webviewer"] as const, "The type of app to create"),
      server: optionalTextOption("server", "The URL of your FileMaker Server"),
      adminApiKey: optionalTextOption("admin-api-key", "Admin API key for OttoFMS"),
      fileName: optionalTextOption(
        "file-name",
        "The FileMaker file name to use, including selecting a local connected file",
      ),
      layoutName: optionalTextOption("layout-name", "The FileMaker layout name to scaffold"),
      schemaName: optionalTextOption("schema-name", "The generated schema name"),
      dataApiKey: optionalTextOption("data-api-key", "The Otto Data API key to use"),
      dataSource: optionalChoiceOption("data-source", ["filemaker", "none"] as const, "The data source to use"),
      noGit: booleanOption("no-git").pipe(withOptionDescription("Skip git initialization")),
      noInstall: booleanOption("no-install").pipe(withOptionDescription("Skip package installation")),
      force: booleanOption("force").pipe(
        withAlias("f"),
        withOptionDescription("Force overwrite target directory when it already contains files"),
      ),
      CI: booleanOption("ci").pipe(withOptionDescription("Deprecated alias for --non-interactive")),
      nonInteractive: booleanOption("non-interactive").pipe(
        withOptionDescription("Never prompt for input; fail when required values are missing"),
      ),
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ dir, ...options }) => {
      const nonInteractive = resolveNonInteractiveMode({
        CI: options.CI,
        nonInteractive: options.nonInteractive,
        ...getCurrentTTYState(),
      });

      const flags: CliFlags = {
        ...defaultCliFlags,
        appType: getOrUndefined(options.appType),
        server: getOrUndefined(options.server),
        adminApiKey: getOrUndefined(options.adminApiKey),
        fileName: getOrUndefined(options.fileName),
        layoutName: getOrUndefined(options.layoutName),
        schemaName: getOrUndefined(options.schemaName),
        dataApiKey: getOrUndefined(options.dataApiKey),
        dataSource: getOrUndefined(options.dataSource),
        noGit: options.noGit,
        noInstall: options.noInstall,
        force: options.force,
        CI: options.CI,
        nonInteractive: options.nonInteractive,
        debug: options.debug,
      };

      return makeLiveLayer({
        cwd: process.cwd(),
        debug: flags.debug === true,
        nonInteractive,
      })(runInit(getOrUndefined(dir), flags));
    },
  ).pipe(withCommandDescription("Create a new project with ProofKit"));
}

function makeAddCommand() {
  return makeCommand(
    "add",
    {
      name: optionalArg(textArg({ name: "name" })).pipe(withArgDescription("Supported add target, currently `addon`")),
      target: optionalArg(textArg({ name: "target" })).pipe(withArgDescription("Add-on target")),
      noInstall: booleanOption("no-install").pipe(withOptionDescription("Skip package installation")),
      CI: booleanOption("ci").pipe(withOptionDescription("Deprecated alias for --non-interactive")),
      nonInteractive: booleanOption("non-interactive").pipe(
        withOptionDescription("Never prompt for input; fail when required values are missing"),
      ),
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ name, target, noInstall, CI, nonInteractive, debug }) =>
      legacyEffect(
        async () => {
          const [{ runAdd }, { initProgramState, state }] = await Promise.all([
            import("~/cli/add/index.js"),
            import("~/state.js"),
          ]);
          initProgramState({
            noInstall,
            ci: CI,
            nonInteractive,
            debug,
          });
          state.baseCommand = "add";
          state.projectDir = process.cwd();
          await runAdd(getOrUndefined(name), { noInstall, target: getOrUndefined(target) });
        },
        { nonInteractive: CI || nonInteractive, debug },
      ),
  ).pipe(withCommandDescription("Add a supported ProofKit add-on."));
}

function makeRemoveCommand() {
  return makeCommand(
    "remove",
    {
      name: optionalArg(textArg({ name: "name" })).pipe(withArgDescription("Component type to remove")),
      CI: booleanOption("ci").pipe(withOptionDescription("Deprecated alias for --non-interactive")),
      nonInteractive: booleanOption("non-interactive").pipe(
        withOptionDescription("Never prompt for input; fail when required values are missing"),
      ),
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ name, CI, nonInteractive, debug }) =>
      legacyEffect(
        async () => {
          const [{ runRemove }, { initProgramState, state }] = await Promise.all([
            import("~/cli/remove/index.js"),
            import("~/state.js"),
          ]);
          initProgramState({
            ci: CI,
            nonInteractive,
            debug,
          });
          state.baseCommand = "remove";
          state.projectDir = process.cwd();
          await runRemove(getOrUndefined(name));
        },
        { nonInteractive: CI || nonInteractive, debug },
      ),
  ).pipe(withCommandDescription("Legacy command. Prefer direct code edits or package-native tools."));
}

function makeTypegenCommand() {
  return makeCommand(
    "typegen",
    {
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ debug }) =>
      legacyEffect(
        async () => {
          const [{ runTypegen }, { state }] = await Promise.all([
            import("~/cli/typegen/index.js"),
            import("~/state.js"),
          ]);
          state.projectDir = process.cwd();
          await runTypegen({
            settings: (await import("~/utils/parseSettings.js")).getSettings(),
          });
        },
        { debug },
      ),
  ).pipe(withCommandDescription("Legacy alias. Prefer `npx @proofkit/typegen`."));
}

function makeDeployCommand() {
  return makeCommand(
    "deploy",
    {
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ debug }) =>
      legacyEffect(
        async () => {
          const [{ runDeploy }, { initProgramState, state }] = await Promise.all([
            import("~/cli/deploy/index.js"),
            import("~/state.js"),
          ]);
          initProgramState({ debug });
          state.baseCommand = "deploy";
          state.projectDir = process.cwd();
          await runDeploy();
        },
        { debug },
      ),
  ).pipe(withCommandDescription("Deploy your app"));
}

function makeUpgradeCommand() {
  return makeCommand(
    "upgrade",
    {
      CI: booleanOption("ci").pipe(withOptionDescription("Deprecated alias for --non-interactive")),
      nonInteractive: booleanOption("non-interactive").pipe(
        withOptionDescription("Never prompt for input; fail when required values are missing"),
      ),
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ CI, nonInteractive, debug }) =>
      legacyEffect(
        async () => {
          const [{ runUpgrade }, { initProgramState, state }] = await Promise.all([
            import("~/cli/update/index.js"),
            import("~/state.js"),
          ]);
          initProgramState({ ci: CI, nonInteractive, debug });
          state.baseCommand = "upgrade";
          state.projectDir = process.cwd();
          await runUpgrade();
        },
        { nonInteractive: CI || nonInteractive, debug },
      ),
  ).pipe(withCommandDescription("Legacy command."));
}

function makeDoctorCommand() {
  return makeCommand(
    "doctor",
    {
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ debug }) =>
      makeLiveLayer({
        cwd: process.cwd(),
        debug: debug === true,
        nonInteractive: true,
      })(runDoctor),
  ).pipe(withCommandDescription("Inspect project health and suggest exact next steps"));
}

function makePromptCommand() {
  return makeCommand(
    "prompt",
    {
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ debug }) =>
      makeLiveLayer({
        cwd: process.cwd(),
        debug: debug === true,
        nonInteractive: true,
      })(runPrompt),
  ).pipe(withCommandDescription("Agent workflow entrypoint placeholder"));
}

const rootCommand = makeCommand(
  cliName,
  {
    CI: booleanOption("ci").pipe(withOptionDescription("Deprecated alias for --non-interactive")),
    nonInteractive: booleanOption("non-interactive").pipe(
      withOptionDescription("Never prompt for input; fail when required values are missing"),
    ),
    debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
  },
  (options) =>
    makeLiveLayer({
      cwd: process.cwd(),
      debug: options.debug === true,
      nonInteractive: resolveNonInteractiveMode({
        CI: options.CI,
        nonInteractive: options.nonInteractive,
        ...getCurrentTTYState(),
      }),
    })(
      runDefaultCommand({
        ...defaultCliFlags,
        CI: options.CI,
        nonInteractive: options.nonInteractive,
        debug: options.debug,
      }),
    ),
).pipe(
  withCommandDescription("Interactive CLI to scaffold and manage ProofKit projects"),
  withSubcommands([
    makeInitCommand(),
    makeDoctorCommand(),
    makePromptCommand(),
    makeAddCommand(),
    makeRemoveCommand(),
    makeTypegenCommand(),
    makeDeployCommand(),
    makeUpgradeCommand(),
  ]),
);

export const cli = run(rootCommand, {
  name: "ProofKit",
  version: getCliVersion(),
});

function isMainEntrypoint(argvPath: string | undefined, moduleUrl: string) {
  if (!argvPath) {
    return false;
  }

  const resolvedModulePath = fileURLToPath(moduleUrl);

  try {
    return realpathSync(argvPath) === realpathSync(resolvedModulePath);
  } catch {
    return path.resolve(argvPath) === path.resolve(resolvedModulePath);
  }
}

const isMainModule = isMainEntrypoint(process.argv[1], import.meta.url);

const debugFlagNames = new Set(["--debug"]);

function shouldShowDebugDetails(argv: readonly string[]) {
  return argv.some((arg) => debugFlagNames.has(arg));
}

export function renderFailure(cause: Cause.Cause<unknown>, showDebugDetails: boolean) {
  const failure = getOrUndefined(Cause.failureOption(cause));

  if (failure && isValidationError(failure)) {
    if (showDebugDetails) {
      console.error(`\n[debug] ${Cause.pretty(cause)}`);
    }
    return;
  }

  if (failure && isCliError(failure)) {
    console.error(getCliErrorMessage(failure));
  } else {
    const error = Cause.squash(cause);
    console.error(error instanceof Error ? error.message : String(error));
  }

  if (showDebugDetails) {
    console.error(`\n[debug] ${Cause.pretty(cause)}`);
  }
}

async function main(argv: readonly string[]) {
  const showDebugDetails = shouldShowDebugDetails(argv);
  const exit = await Effect.runPromiseExit(Effect.provide(cli(argv), nodeContextLayer));

  if (Exit.isFailure(exit)) {
    renderFailure(exit.cause, showDebugDetails);
    process.exitCode = 1;
  }
}

if (isMainModule) {
  renderTitle(getCliVersion());
  main(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
