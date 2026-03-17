import { Command } from "commander";
import { runPromise } from "effect/Effect";
import { runInit } from "~/core/runInit.js";
import type { CliFlags } from "~/core/types.js";
import { ciOption, debugOption, nonInteractiveOption } from "~/globalOptions.js";
import { makeLiveLayer } from "~/services/live.js";

export const makeInitCommand = () =>
  new Command("init")
    .description("Create a new project with the next ProofKit scaffold")
    .argument("[dir]", "The name of the application and the target directory")
    .option("--appType [type]", "The type of app to create", undefined)
    .option("--ui [ui]", undefined, undefined)
    .option("--server [url]", "The URL of your FileMaker Server", undefined)
    .option("--adminApiKey [key]", "Admin API key for OttoFMS", undefined)
    .option("--fileName [name]", "The name of the FileMaker file", undefined)
    .option("--layoutName [name]", "The FileMaker layout name to scaffold", undefined)
    .option("--schemaName [name]", "The generated schema name", undefined)
    .option("--dataApiKey [key]", "The Otto Data API key to use", undefined)
    .option("--dataSource [type]", "The data source to use (filemaker or none)", undefined)
    .option("--noGit", "Skip git initialization", false)
    .option("--noInstall", "Skip package installation", false)
    .option("-f, --force", "Force overwrite target directory when it already contains files", false)
    .addOption(ciOption)
    .addOption(nonInteractiveOption)
    .addOption(debugOption)
    .action(async (name?: string, flags?: CliFlags) => {
      const layer = makeLiveLayer({
        cwd: process.cwd(),
        debug: Boolean(flags?.debug),
        nonInteractive: Boolean(flags?.CI || flags?.nonInteractive),
      });
      await runPromise(runInit(name, flags).pipe(layer));
    });
