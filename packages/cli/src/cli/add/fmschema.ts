import path from "node:path";
import type { OttoAPIKey } from "@proofkit/fmdapi";
import type { ValueListsOptions } from "@proofkit/typegen/config";
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";
import { z } from "zod/v4";
import * as p from "~/cli/prompts.js";
import { addLayout, getExistingSchemas } from "~/generators/fmdapi.js";
import { state } from "~/state.js";
import { getSettings, type Settings } from "~/utils/parseSettings.js";
import { commonFileMakerLayoutPrefixes, getLayouts } from "../fmdapi.js";
import { abortIfCancel } from "../utils.js";

// Regex to validate JavaScript variable names
const VALID_JS_VARIABLE_NAME = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;

export const runAddSchemaAction = async (opts?: {
  projectDir?: string;
  settings: Settings;
  sourceName?: string;
  layoutName?: string;
  schemaName?: string;
  valueLists?: ValueListsOptions;
}) => {
  const settings = getSettings();
  const projectDir = state.projectDir;
  let sourceName = opts?.sourceName;
  if (sourceName) {
    sourceName = opts?.sourceName;
  } else if (settings.dataSources.filter((s) => s.type === "fm").length > 1) {
    // if there is more than one fm data source, we need to prompt for which one to add the layout to
    const dataSourceName = await p.select({
      message: "Which FileMaker data source do you want to add a layout to?",
      options: settings.dataSources.filter((s) => s.type === "fm").map((s) => ({ label: s.name, value: s.name })),
    });
    if (p.isCancel(dataSourceName)) {
      p.cancel();
      process.exit(0);
    }
    sourceName = z.string().parse(dataSourceName);
  }

  if (!sourceName) {
    sourceName = "filemaker";
  }

  const dataSource = settings.dataSources.filter((s) => s.type === "fm").find((s) => s.name === sourceName);
  if (!dataSource) {
    throw new Error(`FileMaker data source ${sourceName} not found in your ProofKit config`);
  }

  const spinner = p.spinner();
  spinner.start("Loading layouts from your FileMaker file...");
  if (settings.envFile) {
    dotenv.config({
      path: path.join(projectDir, settings.envFile),
    });
  }

  const dataApiKey = process.env[dataSource.envNames.apiKey];
  const fmFile = process.env[dataSource.envNames.database];
  const server = process.env[dataSource.envNames.server];

  if (!(dataApiKey && fmFile && server)) {
    spinner.stop("Failed to load layouts");
    p.cancel("Missing required environment variables. Please check your .env file.");
    process.exit(1);
  }

  // Validate API key format
  if (!(dataApiKey.startsWith("KEY_") || dataApiKey.startsWith("dk_"))) {
    spinner.stop("Failed to load layouts");
    p.cancel("Invalid API key format. API key must start with 'KEY_' or 'dk_'.");
    process.exit(1);
  }

  // Type assertion after validation
  const validatedApiKey: OttoAPIKey = dataApiKey as OttoAPIKey;

  const layouts = await getLayouts({
    dataApiKey: validatedApiKey,
    fmFile,
    server,
  });

  const existingConfigResults = getExistingSchemas({
    projectDir,
    dataSourceName: sourceName,
  });

  const existingLayouts = existingConfigResults.map((s) => s.layout).filter(Boolean);

  const existingSchemas = existingConfigResults.map((s) => s.schemaName).filter(Boolean);

  spinner.stop("Loaded layouts from your FileMaker file");

  if (existingLayouts.length > 0) {
    p.note(existingLayouts.join("\n"), "Detected existing layouts in your project");
  }

  // list other common layout names to exclude
  existingLayouts.push("-");

  let passedInLayoutName: string | undefined = opts?.layoutName;
  if (passedInLayoutName === "" || !layouts.includes(passedInLayoutName ?? "")) {
    passedInLayoutName = undefined;
  }

  const selectedLayout =
    passedInLayoutName ??
    abortIfCancel(
      await p.searchSelect({
        message: "Select a new layout to read data from",
        emptyMessage: "No matching layouts found.",
        options: layouts
          .filter((layout) => !existingLayouts.includes(layout))
          .map((layout) => ({
            label: layout,
            value: layout,
            keywords: [layout],
          })),
      }),
    );

  const defaultSchemaName = getDefaultSchemaName(selectedLayout);
  const schemaName =
    opts?.schemaName ||
    abortIfCancel(
      await p.text({
        message: `Enter a friendly name for the new schema.\n${chalk.dim("This will the name by which you refer to this layout in your codebase")}`,
        // initialValue: selectedLayout,
        defaultValue: defaultSchemaName,
        validate: (input) => {
          if (input === "") {
            return; // allow empty input for the default value
          }
          // ensure the input is a valid JS variable name
          if (!VALID_JS_VARIABLE_NAME.test(input)) {
            return "Name must consist of only alphanumeric characters, '_', and must not start with a number";
          }
          if (existingSchemas.includes(input)) {
            return "Schema name must be unique";
          }
          return;
        },
      }),
    ).toString();

  const valueLists =
    opts?.valueLists ??
    ((await p.select({
      message: `Should we use value lists on this layout?\n${chalk.dim(
        "This will allow fields that contain a value list to be auto-completed in typescript and also validated to prevent incorrect values",
      )}`,
      options: [
        {
          label: "Yes, but allow empty fields",
          value: "allowEmpty",
          hint: "Empty fields or values that don't match the value list will be converted to an empty string",
        },
        {
          label: "Yes; empty values should fail validation",
          value: "strict",
          hint: "Empty fields or values that don't match the value list will cause validation to fail",
        },
        {
          label: "No, ignore value lists",
          value: "ignore",
          hint: "Fields will just be typed as strings",
        },
      ],
    })) as ValueListsOptions);

  const valueListsValidated = z.enum(["ignore", "allowEmpty", "strict"]).catch("ignore").parse(valueLists);

  await addLayout({
    runCodegen: true,
    projectDir,
    dataSourceName: sourceName,
    schemas: [
      {
        layoutName: selectedLayout,
        schemaName,
        valueLists: valueListsValidated,
      },
    ],
  });

  p.outro(`Layout "${selectedLayout}" added to your project as "${schemaName}"`);
};

export const makeAddSchemaCommand = () => {
  const addSchemaCommand = new Command("layout")
    .alias("schema")
    .description("Add a new layout to your fmschema file")
    .action(async (opts: { settings: Settings }) => {
      const settings = opts.settings;

      await runAddSchemaAction({ settings });
    });

  return addSchemaCommand;
};

function getDefaultSchemaName(layout: string) {
  let schemaName = layout.replace(/[-\s]/g, "_");
  for (const prefix of commonFileMakerLayoutPrefixes) {
    if (schemaName.startsWith(prefix)) {
      schemaName = schemaName.replace(prefix, "");
    }
  }
  return schemaName;
}
