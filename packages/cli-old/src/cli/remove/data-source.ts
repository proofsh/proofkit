import path from "node:path";
import { Command } from "commander";
import dotenv from "dotenv";
import fs from "fs-extra";
import { z } from "zod/v4";
import * as p from "~/cli/prompts.js";

import { removeFromFmschemaConfig, runCodegenCommand } from "~/generators/fmdapi.js";
import { ciOption, debugOption, nonInteractiveOption } from "~/globalOptions.js";
import { initProgramState, isNonInteractiveMode, state } from "~/state.js";
import { type DataSource, getSettings, setSettings } from "~/utils/parseSettings.js";
import { abortIfCancel, ensureProofKitProject, UserAbortedError } from "../utils.js";

function getDataSourceInfo(source: DataSource) {
  if (source.type !== "fm") {
    return source.type;
  }

  const envFile = path.join(state.projectDir, ".env");
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }

  const server = process.env[source.envNames.server] || "unknown server";
  const database = process.env[source.envNames.database] || "unknown database";

  try {
    // Format the server URL to be more readable
    const serverUrl = new URL(server);
    const formattedServer = serverUrl.hostname;
    return `${formattedServer}/${database}`;
  } catch (error) {
    if (state.debug) {
      console.error("Error parsing server URL:", error);
    }
    return `${server}/${database}`;
  }
}

export const runRemoveDataSourceCommand = async (name?: string) => {
  const settings = getSettings();

  if (settings.dataSources.length === 0) {
    p.note("No data sources found in your project.");
    return;
  }

  let dataSourceName = name;

  // If no name provided, prompt for selection
  if (dataSourceName) {
    // Validate that the provided name exists
    const dataSourceExists = settings.dataSources.some((source) => source.name === dataSourceName);
    if (!dataSourceExists) {
      throw new Error(`Data source "${dataSourceName}" not found in your project.`);
    }
  } else {
    dataSourceName = abortIfCancel(
      await p.select({
        message: "Which data source do you want to remove?",
        options: settings.dataSources.map((source) => {
          let info = "";
          try {
            info = getDataSourceInfo(source);
          } catch (error) {
            if (state.debug) {
              console.error("Error getting data source info:", error);
            }
            info = "unknown connection";
          }
          return {
            label: `${source.name} (${info})`,
            value: source.name,
          };
        }),
      }),
    );
  }

  let confirmed = true;
  if (!isNonInteractiveMode()) {
    confirmed = abortIfCancel(
      await p.confirm({
        message: `Are you sure you want to remove the data source "${dataSourceName}"? This will only remove it from your configuration, not replace any possible usage, which may cause TypeScript errors.`,
      }),
    );

    if (!confirmed) {
      throw new UserAbortedError();
    }
  }

  // Get the data source before removing it
  const dataSource = settings.dataSources.find((source) => source.name === dataSourceName);

  // Remove the data source from settings
  settings.dataSources = settings.dataSources.filter((source) => source.name !== dataSourceName);

  // Save the updated settings
  setSettings(settings);

  if (dataSource?.type === "fm") {
    // For FileMaker data sources, remove from fmschema.config.mjs
    removeFromFmschemaConfig({
      dataSourceName,
    });

    if (state.debug) {
      p.note("Removed schemas from fmschema.config.mjs");
    }

    // Remove the schema folder for this data source
    const schemaFolderPath = path.join(state.projectDir, "src", "config", "schemas", dataSourceName);
    if (fs.existsSync(schemaFolderPath)) {
      fs.removeSync(schemaFolderPath);
      if (state.debug) {
        p.note(`Removed schema folder at ${schemaFolderPath}`);
      }
    }

    // Run typegen to regenerate types
    await runCodegenCommand();
    if (state.debug) {
      p.note("Successfully regenerated types");
    }
  }

  p.note(`Successfully removed data source "${dataSourceName}"`);
};

export const makeRemoveDataSourceCommand = () => {
  const removeDataSourceCommand = new Command("data")
    .description("Remove a data source from your project")
    .option("--name <name>", "Name of the data source to remove")
    .addOption(ciOption)
    .addOption(nonInteractiveOption)
    .addOption(debugOption)
    .action(async (options) => {
      const schema = z.object({
        name: z.string().optional(),
      });
      const validated = schema.parse(options);
      await runRemoveDataSourceCommand(validated.name);
    });

  removeDataSourceCommand.hook("preAction", (_thisCommand, actionCommand) => {
    initProgramState(actionCommand.opts());
    state.baseCommand = "remove";
    ensureProofKitProject({ commandName: "remove" });
  });

  return removeDataSourceCommand;
};
