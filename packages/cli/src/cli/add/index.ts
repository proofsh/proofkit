import { select } from "@clack/prompts";
import type { RegistryIndex } from "@proofkit/registry";
import { Command } from "commander";
import { capitalize, groupBy, uniq } from "es-toolkit";
import ora from "ora";
import { ciOption, debugOption, nonInteractiveOption } from "~/globalOptions.js";
import { initProgramState, state } from "~/state.js";
import { logger } from "~/utils/logger.js";
import { getSettings, type Settings } from "~/utils/parseSettings.js";
import { runAddReactEmailCommand } from "../react-email.js";
import { runAddTanstackQueryCommand } from "../tanstack-query.js";
import { abortIfCancel, ensureProofKitProject } from "../utils.js";
import { makeAddAuthCommand, runAddAuthAction } from "./auth.js";
import { makeAddDataSourceCommand, runAddDataSourceCommand } from "./data-source/index.js";
import { makeAddSchemaCommand, runAddSchemaAction } from "./fmschema.js";
import { makeAddPageCommand, runAddPageAction } from "./page/index.js";
import { installFromRegistry } from "./registry/install.js";
import { listItems } from "./registry/listItems.js";
import { preflightAddCommand } from "./registry/preflight.js";

const runAddFromRegistry = async (_options?: { noInstall?: boolean }) => {
  const settings = getSettings();

  const spinner = ora("Loading available components...").start();
  let items: RegistryIndex;
  try {
    items = await listItems();
  } catch (error) {
    spinner.fail("Failed to load registry components");
    logger.error(error);
    return;
  }

  const itemsNotInstalled = items.filter((item) => !settings.registryTemplates.includes(item.name));

  const groupedByCategory = groupBy(itemsNotInstalled, (item) => item.category);
  const categories = uniq(itemsNotInstalled.map((item) => item.category));

  spinner.succeed();

  const addType = abortIfCancel(
    await select({
      message: "What do you want to add to your project?",
      options: [
        // if there are pages available to install, show them first
        ...(categories.includes("page") ? [{ label: "Page", value: "page" }] : []),

        // only show schema option if there is at least one data source
        ...(settings.dataSources.length > 0
          ? [
              {
                label: "Schema",
                value: "schema",
                hint: "load data from a new table or layout from an existing data source",
              },
            ]
          : []),

        {
          label: "Data Source",
          value: "data",
          hint: "to connect to a new database or FileMaker file",
        },

        // show the rest of the categories
        ...categories
          .filter((category) => category !== "page")
          .map((category) => ({
            label: capitalize(category),
            value: category,
          })),
      ],
    }),
  );

  if (addType === "schema") {
    await runAddSchemaAction();
  } else if (addType === "data") {
    await runAddDataSourceCommand();
  } else if ((categories as string[]).includes(addType)) {
    // one of the categories
    const itemsFromCategory = groupedByCategory[addType as keyof typeof groupedByCategory];

    const itemName = abortIfCancel(
      await select({
        message: `Select a ${addType} to add to your project`,
        options: itemsFromCategory.map((item) => ({
          label: item.title,
          hint: item.description,
          value: item.name,
        })),
      }),
    );

    await installFromRegistry(itemName);
  } else {
    logger.error(`Could not find any available components in the category "${addType}"`);
  }
};

export const runAdd = async (name: string | undefined, options?: { noInstall?: boolean }) => {
  if (name === "tanstack-query") {
    return await runAddTanstackQueryCommand();
  }
  if (name !== undefined) {
    // an arbitrary name was provided, so we'll try to install from the registry
    return await installFromRegistry(name);
  }

  let settings: Settings;
  try {
    settings = getSettings();
  } catch {
    await preflightAddCommand();
    return await runAddFromRegistry(options);
  }

  if (settings.ui === "shadcn") {
    return await runAddFromRegistry(options);
  }
  ensureProofKitProject({ commandName: "add" });

  const addType = abortIfCancel(
    await select({
      message: "What do you want to add to your project?",
      options: [
        { label: "Page", value: "page" },
        // only show schema option if there is at least one data source
        ...(settings.dataSources.length > 0
          ? [
              {
                label: "Schema",
                value: "schema",
                hint: "load data from a new table or layout from an existing data source",
              },
            ]
          : []),
        { label: "React Email", value: "react-email" },
        {
          label: "Data Source",
          value: "data",
          hint: "to connect to a new database or FileMaker file",
        },
        ...(settings.auth.type === "none" && settings.appType === "browser" ? [{ label: "Auth", value: "auth" }] : []),
      ],
    }),
  );

  if (addType === "auth") {
    await runAddAuthAction();
  } else if (addType === "data") {
    await runAddDataSourceCommand();
  } else if (addType === "page") {
    await runAddPageAction();
  } else if (addType === "schema") {
    await runAddSchemaAction();
  } else if (addType === "react-email") {
    await runAddReactEmailCommand({ noInstall: options?.noInstall });
  }
};

export const makeAddCommand = () => {
  const addCommand = new Command("add")
    .description("Add a new component to your project")
    .argument("[name]", "Type of component to add")
    .addOption(ciOption)
    .addOption(nonInteractiveOption)
    .addOption(debugOption)
    .option("--noInstall", "Do not run your package manager install command", false)
    .action(async (name, options) => {
      await runAdd(name, options);
    });

  addCommand.hook("preAction", (_thisCommand, _actionCommand) => {
    // console.log("preAction", _actionCommand.opts());
    initProgramState(_actionCommand.opts());
    state.baseCommand = "add";
  });
  addCommand.hook("preSubcommand", (_thisCommand, _subCommand) => {
    // console.log("preSubcommand", _subCommand.opts());
    initProgramState(_subCommand.opts());
    state.baseCommand = "add";
  });

  addCommand.addCommand(makeAddAuthCommand());
  addCommand.addCommand(makeAddPageCommand());
  addCommand.addCommand(makeAddSchemaCommand());
  addCommand.addCommand(makeAddDataSourceCommand());
  return addCommand;
};
