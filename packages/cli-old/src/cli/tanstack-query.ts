import { Command } from "commander";
import * as p from "~/cli/prompts.js";

import { injectTanstackQuery } from "~/generators/tanstack-query.js";

export const runAddTanstackQueryCommand = async () => {
  const spinner = p.spinner();
  spinner.start("Adding Tanstack Query");
  await injectTanstackQuery();
  spinner.stop("Tanstack Query added");
};

export const makeAddTanstackQueryCommand = () => {
  const addTanstackQueryCommand = new Command("tanstack-query")
    .description("Add Tanstack Query to your project")
    .action(runAddTanstackQueryCommand);

  return addTanstackQueryCommand;
};
