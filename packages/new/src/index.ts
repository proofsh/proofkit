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
import { layer as nodeContextLayer } from "@effect/platform-node/NodeContext";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
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
    const fs = yield* FileSystemService;
    const consoleService = yield* ConsoleService;
    const flags = { ...defaultCliFlags, ...rawFlags };

    if (cliContext.nonInteractive || flags.CI || flags.nonInteractive) {
      return yield* Effect.fail(
        new Error(
          "The default command is interactive-only in non-interactive mode. Run an explicit command such as `proofkit-new init <name> --non-interactive`.",
        ),
      );
    }

    const settingsPath = path.join(cliContext.cwd, "proofkit.json");
    const hasProofKitProject = yield* Effect.promise(() => fs.exists(settingsPath));

    if (hasProofKitProject) {
      intro(`Found ${proofGradient("ProofKit")} project`);
      consoleService.note(
        [
          "Project command routing is coming soon in this new CLI.",
          "For now, the available explicit command is `proofkit-new init <name>`.",
        ].join("\n"),
        "Coming soon",
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
  ).pipe(withCommandDescription("Create a new project with the next ProofKit scaffold"));
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
  withCommandDescription("Internal scaffold package for the next ProofKit CLI"),
  withSubcommands([makeInitCommand()]),
);

export const cli = run(rootCommand, {
  name: "ProofKit New",
  version: getCliVersion(),
});

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  renderTitle(getCliVersion());
  runMain(cli(process.argv).pipe(Effect.provide(nodeContextLayer)));
}
