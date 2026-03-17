import * as p from "@clack/prompts";
import { Command } from "commander";
import { z } from "zod/v4";

import { ensureProofKitProject } from "~/cli/utils.js";
import { ciOption, nonInteractiveOption } from "~/globalOptions.js";
import { initProgramState } from "~/state.js";
import { promptForFileMakerDataSource } from "./filemaker.js";

const dataSourceType = z.enum(["fm", "supabase"]);
export const runAddDataSourceCommand = async () => {
  const dataSource = dataSourceType.parse(
    await p.select({
      message: "Which data souce do you want to add?",
      options: [
        { label: "FileMaker", value: "fm" },
        { label: "Supabase", value: "supabase" },
      ],
    }),
  );

  if (dataSource === "supabase") {
    throw new Error("Not implemented");
  }
  if (dataSource === "fm") {
    await promptForFileMakerDataSource({ projectDir: process.cwd() });
  } else {
    throw new Error("Invalid data source");
  }
};

export const makeAddDataSourceCommand = () => {
  const addDataSourceCommand = new Command("data");
  addDataSourceCommand.description("Add a new data source to your project");
  addDataSourceCommand.addOption(ciOption);
  addDataSourceCommand.addOption(nonInteractiveOption);

  addDataSourceCommand.hook("preAction", (_thisCommand, actionCommand) => {
    initProgramState(actionCommand.opts());
    const settings = ensureProofKitProject({ commandName: "add" });
    actionCommand.setOptionValue("settings", settings);
  });

  // addDataSourceCommand.action();
  return addDataSourceCommand;
};
