import { optional as optionalArg, text as textArg, withDescription as withArgDescription } from "@effect/cli/Args";
import { make, withDescription } from "@effect/cli/Command";
import {
  boolean,
  choice,
  optional,
  text,
  withAlias,
  withDescription as withOptionDescription,
} from "@effect/cli/Options";
import { getOrUndefined } from "effect/Option";
import { runInit } from "~/core/runInit.js";
import type { CliFlags } from "~/core/types.js";
import { makeLiveLayer } from "~/services/live.js";

const dirArg = textArg({ name: "dir" }).pipe(
  withArgDescription("The name of the application and the target directory"),
  optionalArg,
);

const optionalTextOption = (name: string, description: string) =>
  text(name).pipe(withOptionDescription(description), optional);

const optionalChoiceOption = <T extends string>(name: string, choices: readonly T[], description: string) =>
  choice(name, choices).pipe(withOptionDescription(description), optional);

export const makeInitCommand = () => {
  const initCommand = make(
    "init",
    {
      dir: dirArg,
      appType: optionalChoiceOption("app-type", ["browser", "webviewer"], "The type of app to create"),
      ui: optionalChoiceOption("ui", ["shadcn", "mantine"], "The UI scaffold to create"),
      server: optionalTextOption("server", "The URL of your FileMaker Server"),
      adminApiKey: optionalTextOption("admin-api-key", "Admin API key for OttoFMS"),
      fileName: optionalTextOption("file-name", "The name of the FileMaker file"),
      layoutName: optionalTextOption("layout-name", "The FileMaker layout name to scaffold"),
      schemaName: optionalTextOption("schema-name", "The generated schema name"),
      dataApiKey: optionalTextOption("data-api-key", "The Otto Data API key to use"),
      dataSource: optionalChoiceOption("data-source", ["filemaker", "none"], "The data source to use"),
      noGit: boolean("no-git").pipe(withOptionDescription("Skip git initialization")),
      noInstall: boolean("no-install").pipe(withOptionDescription("Skip package installation")),
      force: boolean("force").pipe(
        withAlias("f"),
        withOptionDescription("Force overwrite target directory when it already contains files"),
      ),
      CI: boolean("ci").pipe(withOptionDescription("Deprecated alias for --non-interactive")),
      nonInteractive: boolean("non-interactive").pipe(
        withOptionDescription("Never prompt for input; fail when required values are missing"),
      ),
      debug: boolean("debug").pipe(withOptionDescription("Run in debug mode")),
    },
    ({ dir, ...config }) => {
      const flags: CliFlags = {
        ...config,
        appType: getOrUndefined(config.appType),
        ui: getOrUndefined(config.ui),
        server: getOrUndefined(config.server),
        adminApiKey: getOrUndefined(config.adminApiKey),
        fileName: getOrUndefined(config.fileName),
        layoutName: getOrUndefined(config.layoutName),
        schemaName: getOrUndefined(config.schemaName),
        dataApiKey: getOrUndefined(config.dataApiKey),
        dataSource: getOrUndefined(config.dataSource),
        default: false,
        importAlias: "~/",
      };
      const layer = makeLiveLayer({
        cwd: process.cwd(),
        debug: flags.debug === true,
        nonInteractive: Boolean(flags.CI || flags.nonInteractive),
      });
      return layer(runInit(getOrUndefined(dir), flags));
    },
  );

  return initCommand.pipe(withDescription("Create a new project with the next ProofKit scaffold"));
};
