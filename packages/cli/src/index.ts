#!/usr/bin/env node
import { readFileSync } from "node:fs";
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
  TemplateService,
} from "~/core/context.js";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { resolveInitRequest } from "~/core/resolveInitRequest.js";
import type { CliFlags } from "~/core/types.js";
import { makeLiveLayer } from "~/services/live.js";
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
  try {
    const packageJsonUrl = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(fileURLToPath(packageJsonUrl), "utf8")) as { version?: string };
    return packageJson.version ?? "0.0.0-private";
  } catch {
    return "0.0.0-private";
  }
}

export const runInit = (name?: string, rawFlags?: Partial<CliFlags>) =>
  Effect.gen(function* () {
    const templateService = yield* TemplateService;
    const packageManagerService = yield* PackageManagerService;
    const request = yield* resolveInitRequest(name, { ...defaultCliFlags, ...rawFlags });
    const templateDir = templateService.getTemplateDir(request.appType, request.ui);
    const packageManagerVersion = yield* Effect.promise(() =>
      packageManagerService.getVersion(request.packageManager, request.cwd),
    );
    const plan = planInit(request, { templateDir, packageManagerVersion });
    yield* executeInitPlan(plan);
    return { request, plan };
  });

export const runDefaultCommand = (rawFlags?: Partial<CliFlags>) =>
  Effect.gen(function* () {
    const cliContext = yield* CliContext;
    const fsService = yield* FileSystemService;
    const consoleService = yield* ConsoleService;
    const flags = { ...defaultCliFlags, ...rawFlags };

    if (cliContext.nonInteractive || flags.CI || flags.nonInteractive) {
      throw new Error(
        "The default command is interactive-only in non-interactive mode. Run an explicit command such as `proofkit init <name> --non-interactive`.",
      );
    }

    const settingsPath = path.join(cliContext.cwd, "proofkit.json");
    const hasProofKitProject = yield* Effect.promise(() => fsService.exists(settingsPath));

    if (hasProofKitProject) {
      intro(`Found ${proofGradient("ProofKit")} project`);
      consoleService.note(
        [
          "Project command routing is being migrated into the Effect CLI surface.",
          "Use an explicit command such as `proofkit add`, `proofkit remove`, `proofkit typegen`, `proofkit deploy`, or `proofkit upgrade`.",
        ].join("\n"),
        "Project commands",
      );
      return;
    }

    intro(`No ${proofGradient("ProofKit")} project found, running \`init\``);
    yield* runInit(undefined, {
      ...flags,
      default: true,
    });
  });

const initDirectoryArg = optionalArg(textArg({ name: "dir" })).pipe(
  withArgDescription("The project name or target directory"),
);

function optionalTextOption(name: string, description: string) {
  return optionalOption(textOption(name).pipe(withOptionDescription(description)));
}

function optionalChoiceOption<Choices extends readonly string[]>(name: string, choices: Choices, description: string) {
  return optionalOption(choiceOption(name, choices).pipe(withOptionDescription(description)));
}

function legacyEffect<T>(runLegacy: () => Promise<T>, options?: { nonInteractive?: boolean; debug?: boolean }) {
  return makeLiveLayer({
    cwd: process.cwd(),
    debug: options?.debug === true,
    nonInteractive: options?.nonInteractive === true,
  })(Effect.promise(runLegacy));
}

function makeInitCommand() {
  return makeCommand(
    "init",
    {
      dir: initDirectoryArg,
      appType: optionalChoiceOption("app-type", ["browser", "webviewer"] as const, "The type of app to create"),
      ui: optionalChoiceOption("ui", ["shadcn", "mantine"] as const, "The UI scaffold to create"),
      server: optionalTextOption("server", "The URL of your FileMaker Server"),
      adminApiKey: optionalTextOption("admin-api-key", "Admin API key for OttoFMS"),
      fileName: optionalTextOption("file-name", "The name of the FileMaker file"),
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
      const flags: CliFlags = {
        ...defaultCliFlags,
        appType: getOrUndefined(options.appType),
        ui: getOrUndefined(options.ui),
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
        nonInteractive: Boolean(flags.CI || flags.nonInteractive),
      })(runInit(getOrUndefined(dir), flags));
    },
  ).pipe(withCommandDescription("Create a new project with ProofKit"));
}

function makeAddCommand() {
  return makeCommand(
    "add",
    {
      name: optionalArg(textArg({ name: "name" })).pipe(withArgDescription("Component or registry item to add")),
      noInstall: booleanOption("no-install").pipe(withOptionDescription("Skip package installation")),
      CI: booleanOption("ci").pipe(withOptionDescription("Deprecated alias for --non-interactive")),
      nonInteractive: booleanOption("non-interactive").pipe(
        withOptionDescription("Never prompt for input; fail when required values are missing"),
      ),
      debug: booleanOption("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ name, noInstall, CI, nonInteractive, debug }) =>
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
          await runAdd(getOrUndefined(name), { noInstall });
        },
        { nonInteractive: CI || nonInteractive, debug },
      ),
  ).pipe(withCommandDescription("Add a new component to your project"));
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
  ).pipe(withCommandDescription("Remove a component from your project"));
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
  ).pipe(withCommandDescription("Generate types for your project"));
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
  ).pipe(withCommandDescription("Upgrade ProofKit components in your project"));
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
      nonInteractive: Boolean(options.CI || options.nonInteractive),
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

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const debugFlagNames = new Set(["--debug"]);

function shouldShowDebugDetails(argv: readonly string[]) {
  return argv.some((arg) => debugFlagNames.has(arg));
}

function renderFailure(cause: Cause.Cause<unknown>, showDebugDetails: boolean) {
  const failure = getOrUndefined(Cause.failureOption(cause));

  if (failure && !isValidationError(failure)) {
    const error = Cause.squash(cause);
    console.error(error instanceof Error ? error.message : String(error));
  } else if (!failure) {
    const error = Cause.squash(cause);
    console.error(error instanceof Error ? error.message : String(error));
  }

  if (showDebugDetails) {
    console.error(`\n[debug] ${Cause.pretty(cause)}`);
  }
}

async function main(argv: readonly string[]) {
  const showDebugDetails = shouldShowDebugDetails(argv);
  const exit = await Effect.runPromiseExit(cli(argv).pipe(Effect.provide(nodeContextLayer)));

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
