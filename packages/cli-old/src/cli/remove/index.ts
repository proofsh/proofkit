import { Command } from "commander";
import * as p from "~/cli/prompts.js";

import { ciOption, debugOption } from "~/globalOptions.js";
import { initProgramState, state } from "~/state.js";
import { getSettings } from "~/utils/parseSettings.js";
import { abortIfCancel, ensureProofKitProject } from "../utils.js";
import { makeRemoveDataSourceCommand, runRemoveDataSourceCommand } from "./data-source.js";
import { makeRemovePageCommand, runRemovePageAction } from "./page.js";
import { makeRemoveSchemaCommand, runRemoveSchemaAction } from "./schema.js";

export const runRemove = async (_name: string | undefined) => {
  const settings = getSettings();

  const removeType = abortIfCancel(
    await p.select({
      message: "What do you want to remove from your project?",
      options: [
        { label: "Page", value: "page" },
        {
          label: "Schema",
          value: "schema",
          hint: "remove a table or layout schema",
        },
        ...(settings.appType === "browser"
          ? [
              {
                label: "Data Source",
                value: "data",
                hint: "remove a database or FileMaker connection",
              },
            ]
          : []),
      ],
    }),
  );

  if (removeType === "data") {
    await runRemoveDataSourceCommand();
  } else if (removeType === "page") {
    await runRemovePageAction();
  } else if (removeType === "schema") {
    await runRemoveSchemaAction();
  }
};

export function makeRemoveCommand() {
  const removeCommand = new Command("remove")
    .description("Remove a component from your project")
    .argument("[name]", "Type of component to remove")
    .addOption(ciOption)
    .addOption(debugOption)
    .action(runRemove);

  removeCommand.hook("preAction", (_thisCommand, _actionCommand) => {
    initProgramState(_actionCommand.opts());
    state.baseCommand = "remove";
    ensureProofKitProject({ commandName: "remove" });
  });
  removeCommand.hook("preSubcommand", (_thisCommand, _subCommand) => {
    initProgramState(_subCommand.opts());
    state.baseCommand = "remove";
    ensureProofKitProject({ commandName: "remove" });
  });

  // Add subcommands
  removeCommand.addCommand(makeRemoveDataSourceCommand());
  removeCommand.addCommand(makeRemovePageCommand());
  removeCommand.addCommand(makeRemoveSchemaCommand());

  return removeCommand;
}
