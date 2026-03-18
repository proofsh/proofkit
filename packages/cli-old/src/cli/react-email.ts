import { Command, Option } from "commander";
import * as p from "~/cli/prompts.js";

import { installReactEmail } from "~/installers/react-email.js";

export const runAddReactEmailCommand = async ({
  noInstall,
  installServerFiles,
}: {
  noInstall?: boolean;
  installServerFiles?: boolean;
} = {}) => {
  const spinner = p.spinner();
  spinner.start("Adding React Email");
  await installReactEmail({ noInstall, installServerFiles });
  spinner.stop("React Email added");
};

export const makeAddReactEmailCommand = () => {
  const addReactEmailCommand = new Command("react-email")
    .description("Add React Email scaffolding to your project")
    .addOption(new Option("--noInstall", "Do not run your package manager install command").default(false))
    .option("--installServerFiles", "Also scaffold provider-specific server email files", false)
    .action((args: { noInstall?: boolean; installServerFiles?: boolean }) => runAddReactEmailCommand(args));

  return addReactEmailCommand;
};
